# DataPilot — Decisions Log

Each entry: the decision, the alternative considered, and why. This doubles as interview preparation — every answer here is a spoken answer waiting to happen.

## D1 — Express.js backend, separate from Next.js
**Alternative:** Next.js API routes (single deployable).
**Why:** Developer fluency — on a 7-day timeline, speed with a known tool beats architectural minimalism. Secondary benefit: the engine (introspection, retrieval, generation loop) lives in a dedicated service, cleanly separated from the frontend. The engine modules are framework-free, so the separation is real, not cosmetic.
**Honest tradeoff to admit if asked:** a single Next.js app would also have worked at this scale; the choice was pragmatic, not architectural necessity.

## D2 — In-memory cosine similarity, NOT pgvector / vector DB
**Alternative:** pgvector extension, or a hosted vector database.
**Why:** The search space is the tables of one database — tens of items, not millions. All embeddings fit in memory; cosine similarity over ~40 vectors runs in well under a millisecond. A vector database here is over-engineering. Implementing the similarity math directly (normalize → dot product) also means the semantic-search mechanism is fully understood, not abstracted away.
**When the answer flips:** searching across thousands of tables/documents, needing persistence-side filtering, or approximate-nearest-neighbor at scale → pgvector or a dedicated store becomes right.

## D3 — Two-database separation: Prisma for app DB, raw `pg` for user DB
**Alternative:** one client for both.
**Why:** The app's own schema is known and stable → Prisma's type safety pays off. The user's database is unknown, arbitrary, and untrusted → an ORM is useless there; introspection and query execution need raw SQL against system catalogs. Separating the code paths (`db/` vs `userdb/`) also makes the read-only guarantee auditable: only one module in the codebase can touch user data, and it hard-codes the read-only session flag.

## D4 — AST-based SQL validation (`node-sql-parser`), never regex
**Alternative:** regex blocklist (reject strings containing DROP/DELETE/etc.).
**Why:** Regex is trivially bypassed — comments (`DR/**/OP`), casing, nesting, string literals containing keywords that cause false rejections. Parsing to an AST and requiring the root node to be a single SELECT is a whitelist, not a blocklist: everything not explicitly allowed is rejected.

## D5 — Defense in depth for query safety (four layers)
Read-only DB role → AST SELECT-only validation → execution limits (timeout, row cap) → prompt-injection fencing of result data. **Rationale:** each layer can individually fail (a parser bug, a misconfigured role); the system stays safe unless all fail simultaneously. Any single-layer design has a single point of failure.

## D6 — Validation BEFORE execution, with schema-existence checking
**Alternative:** just run the SQL and catch DB errors.
**Why:** Hallucinated column names are the most common LLM SQL failure. Catching them pre-execution via the SchemaProfile is cheaper (no round trip to the user's DB), safer, and produces better retry feedback — the failure message can name the actual available columns, which is what makes the retry loop converge instead of flailing.

## D7 — Max 3 attempts in the self-correction loop
**Why:** Empirically (to be confirmed by the benchmark), retries past 2–3 rarely recover — if the model is still wrong after seeing the exact error and the real column list, the failure is usually logical, not syntactic, and more attempts just add latency and cost. Bounded retries also make worst-case latency predictable.

### D7a — `security` failures terminate the loop; they are never retried
**Alternative:** retry every failure type, per a literal reading of "on any fail: attempt++".
**Why:** A security violation is categorically different from the other failures. `hallucination`, `validation`, and `execution` are *mistakes to converge on* — the model wrote a wrong column, malformed SQL, or hit a runtime error, and showing it the real schema or the pg error reliably fixes it. A `security` failure means the model tried to do something the system must **refuse**, and re-prompting is coaxing the same model that just tried to `DROP` a table. Bounded retries should be spent on convergence, not on negotiating with a request that must be denied.
**Evidence:** with retries enabled, "drop the usr table" produced `DROP TABLE public.usr` (blocked), then on retry produced `SELECT 1` — which executed and reported **success**, returning a meaningless answer for a request that should have been refused. With security terminal, it returns `ok:false, security` in one attempt.
**Note:** this also resolves an ambiguity in `architecture.md`, whose retry-feedback format enumerates only `hallucination | validation | execution` — `security` was deliberately absent from the retryable types. Either way the dangerous SQL never reaches the database: validation runs before execution, and the unit tests assert `execute` is never called on a security failure.

## D8 — LLM-generated table descriptions at ingest time
**Alternative:** embed raw table/column names only.
**Why:** Real schemas have names like `usr_txn_amt_v2`. Embedding bare identifiers retrieves poorly. Generating a one-time natural-language description per table (from its columns + sample values) and embedding "name + columns + description + samples" bridges the vocabulary gap between how users ask ("sales", "revenue") and how schemas are named (`pay_txn.txn_amt_inr`). One-time cost at connect, paid back on every query.

## D9 — Deterministic chart selection, not LLM-chosen
**Alternative:** ask the LLM which chart to render.
**Why:** Chart choice is a function of result shape (column types, row count) — a lookup table, not a judgment call. Deterministic rules are free, instant, and never hallucinate a chart type the frontend can't render. Principle: use the LLM only where the problem is actually fuzzy.

## D10 — Provider-agnostic LLM/embedding interfaces
**Why:** Model pricing and quality shift monthly; the engine should not care. `LLMProvider` and `EmbeddingProvider` interfaces with env-configured, OpenAI-compatible implementations mean swapping providers is a config change, not a refactor. Also allows using a cheap/free model during development and a stronger one for the recorded benchmark.

## D11 — Query logs as a first-class table from Day 3
**Why:** The benchmark (Day 6) is the project's credibility centerpiece — "measured, not just built." Logging every attempt (question, retrieved tables, SQL, failure type, latency) from the first end-to-end query means the benchmark is a reporting job over existing data, not a rushed instrumentation retrofit.

## D12 — Postgres only
**Why:** Multi-dialect support is breadth, not depth — each dialect multiplies introspection queries and SQL edge cases without adding a single new engineering idea. The interesting problems (retrieval, self-correction, safety) are dialect-independent. Cutting it protected the 7-day timeline for the parts that matter.

## D13 — JWT + row-level tenancy, not orgs/roles/OAuth
**Alternative:** full org model (teams, roles, invites) or an auth provider (Auth0/Clerk/NextAuth).
**Why:** The product's data model makes tenancy essential — users store database credentials, so isolation is a security requirement, not a feature. But isolation only needs row-level scoping: every `Connection` and `QueryLog` carries a `userId`, all queries filter by it, and one ownership helper (`getOwnedConnection`) centralizes the check so it can't be forgotten route-by-route. Cross-tenant requests return 404 rather than 403 to avoid leaking resource existence. Orgs, roles, and OAuth add schema and UI complexity without adding a new engineering idea, so they were cut. Hand-rolling bcrypt+JWT (vs. an auth provider) was chosen deliberately: it keeps the auth flow fully explainable in an interview — token issuance, verification middleware, expiry — instead of "the library did it."
**Revisited (Day 2):** a migration to Supabase Auth (+ Google OAuth) was considered and declined — it would trade the fully-explainable hand-rolled flow for "the library did it," which is exactly what D13 set out to avoid.

## D14 — Different providers for LLM vs embeddings (OpenRouter chat + Gemini embeddings)
**Context:** D10 built the provider split as a hedge; Day 2 exercised it for real. Chat/SQL generation runs on OpenRouter (`qwen/qwen3-coder`); embeddings run on Google Gemini (`gemini-embedding-001`, free tier).
**Why the split:** OpenRouter has no embeddings endpoint, and the one embedding model it does serve (`qwen/qwen3-embedding-8b`) was measured to discriminate poorly on this task — for "what were last month's sales?" it ranked `inventory_snap` above every orders/payments table, with all scores crammed into a ~0.10 band, and it was slow (~10s/call) and timed out on batches. Gemini's embedding model cleanly separated relevant tables (support-ticket queries isolate `support_tix` with a wide margin) and was ~5× faster. Because the engine depends only on the `EmbeddingProvider`/`LLMProvider` interfaces, this was a pure `.env` change — no code touched. That is exactly the payoff D10 predicted.
**Small-schema retrieval guard:** k=6 is right at scale but returns almost the whole schema on the 8-table seed; retrieval now caps the direct set at `min(k, ceil(tableCount/2))` so it stays selective, with FK-neighbor expansion still pulling in join tables.
## D15 — LangGraph for the self-correction loop
**Alternative:** the hand-rolled bounded `for` loop the orchestrator originally was (Day 4).
**Why:** The retry orchestrator is the one place in the codebase with real control-flow complexity — a three-stage pipeline, a conditional back-edge, a terminal branch, and carried state (`feedback`, `attemptNumber`). Encoding that in `continue` statements makes the shape implicit: you have to read the whole function to see that `security` never reaches `execute`. As a `StateGraph` the topology is declared rather than inferred — nodes `generate`/`validate`/`execute`, conditional edges naming exactly where control can go — so the safety property is visible in the edge table instead of buried in a branch. Adding a stage later (a planner, a judge) is an edge change, not a re-read of the loop body.

**How it's contained.** LangGraph lives only in `engine/loop/`; nothing else imports it. The graph still depends solely on the `LLMProvider` interface, an injected `execute(sql)` function, and an `onAttempt` callback — so the loop reaches for no I/O of its own, and providers/callbacks stay in closures rather than in graph state (state you can't inspect is state you can't debug).

**Guarantees preserved, and proven.** The migration was gated on the Day 4 assertion suite passing **unchanged** — 23/23, including the two that matter: `execute` is never called on a `security` failure (D7a), and a security failure costs exactly one LLM call rather than coaxing the model. `retryOrEnd` (not the graph) enforces the 3-attempt cap (D7); LangGraph's `recursionLimit` is set as a backstop so an edge-routing bug degrades into a `GraphRecursionError` rather than an unbounded, billable loop.

**Honest costs, measured.** The loop grew from **162 → 271 lines**, and `@langchain/langgraph` + `@langchain/core` add **~23 MB** of `node_modules`. So this buys legibility and extensibility, not brevity or leanness. The counter-argument — that a ~160-line loop with one back-edge is simple enough that a graph runtime is overhead, and that hand-rolling keeps the mechanism fully explainable (the D2/D13 thesis) — is real, and worth conceding in an interview before making the case above.
**When the answer flips back:** if the orchestrator never grows past one back-edge, the framework never pays for itself. It starts earning its keep with multiple cooperating agents, tool-calling, parallel candidate-SQL with a judge, durable checkpointing/resumption, or human-in-the-loop approval — none of which the MVP needs today.

## D16 — Redux Toolkit (redux-thunk) for frontend state, feature-based frontend
**Alternative:** component-local `useState` for loading/error (what the UI had through Day 5), or a server-state library (React Query / SWR).
**Why:** By Day 5 every screen had re-declared the same three things — `loading`, `error`, and a `try/catch` around `apiFetch`. That is the bug surface: a component forgets to clear the error, or leaves a spinner stuck on. Redux Toolkit's `createAsyncThunk` models a request as `pending → fulfilled | rejected`, and two helpers make it a single place:
- `createApiThunk` — the one spot an API error becomes state. It extracts the backend's friendly `{ error }` message (never a raw stack) and, on a 401, clears the token and dispatches `sessionExpired` so an expired session logs out from one place instead of being re-handled in every component that happens to fetch.
- `attachAsync(builder, thunk, selectRequest, onFulfilled?, onPending?)` — the one spot `pending → loading`, `rejected → error`, `fulfilled → success` is written. A slice supplies only *which* `RequestState` slot a thunk owns and what to do with its payload.

**A distinction worth keeping:** a query the engine *ran* but couldn't answer (hallucination, a security refusal) returns HTTP 200 with `ok: false`. That is a **result**, not a request failure — the thunk fulfils and the UI renders the failure with its attempt trail. Only transport/auth/404 errors reject. Conflating the two would have shown "Request failed" for a perfectly-working security refusal.

**Honest tradeoff:** React Query is the better fit for pure server-state caching, and Redux is more ceremony than a four-screen app strictly needs. Redux was chosen for an explicit, inspectable state machine (and because the loading/error consolidation was the actual requirement, not caching). The typing cost is real: RTK's `AsyncThunk` is contravariant on `rejectValue` and union-infers `Returned` as `T | undefined`, so `attachAsync` takes the three action creators structurally and asserts the payload type once, rather than fighting the generics at every call site.

**Route protection** lives in two guards (`RequireAuth`, `RequireGuest`) applied by the `(app)` and `(public)` route-group layouts — so a page never re-implements a redirect. Both wait on `auth.hydrated` (the token is read from `localStorage` in an effect, since it doesn't exist during SSR) and neither renders children while a redirect is pending. Verified: an unauthenticated request for `/connections` or `/profile` returns only a skeleton — no protected markup is ever served.

**Styling** is token-first: raw values live once on `:root` (with a single dark-mode override) and are exposed to Tailwind via `@theme`, so components speak `bg-surface` / `text-fg-muted` / `border-line`. The chart palette stays the validated categorical set from Day 5. Changing the brand colour is a one-line edit, not a find-and-replace.

## D17 — Demo mode: ephemeral tenants cloned from a template, not a shared account
**Alternative:** one shared demo login, or a long-lived token embedded in the portfolio URL.
**Why:** a shared account breaks the very isolation the product sells — concurrent visitors would see each other's query logs, and one visitor pasting a private credential would expose that database to every other visitor. A URL token leaks into history/referrers and can't be revoked without rotating `JWT_SECRET`. Instead `POST /auth/demo` creates a real throwaway tenant and **clones** the template connection into it: row copies of the Connection (same ciphertext — same `ENCRYPTION_KEY`) and SchemaProfile (embeddings and cached summary included), so no LLM call and no scan at demo time. The same row-level tenancy that protects real users protects each visitor; the demo *demonstrates* the security model instead of quietly bypassing it.
**Guardrails, all measured:** per-IP creation limit (5/h, in-memory — accepted as per-instance), hourly query cap enforced by counting `QueryLog` (the benchmark ledger doubles as the rate-limit ledger, D11), 2h tokens, 24h retention with a lazy sweep on creation (cascade deletes wipe the whole sandbox), and a global live-tenant ceiling against IP-rotating abuse.
**Self-healing warm:** a template rescan nulls its cached summary by design, and a clone copies that null — every visitor would then pay the LLM wait on landing (observed: 8.1s). Demo creation therefore warms the template summary first; at most one request regenerates, everyone after clones a warm cache (measured: 478ms summary load, ~2.2s creation once warm).
