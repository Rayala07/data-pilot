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