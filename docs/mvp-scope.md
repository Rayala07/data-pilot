# DataPilot - MVP Scope (7 days × 4 hours)

Hard rule: nothing outside this document gets built. If a feature seems missing, ask the developer - do not add it.

## Day-by-day plan

### Day 1 - Foundation + auth + connect & introspect
Build: repo scaffold (Next app + Express app + Prisma setup), **authentication** (email/password signup + login, bcrypt-hashed passwords, JWT bearer tokens, auth middleware protecting every route except signup/login), Prisma models (`User`, `Connection`, `SchemaProfile`, `QueryLog` - every `Connection` and `QueryLog` carries a `userId`, and ALL queries in the app are scoped by it), connection endpoint with read-only enforcement and graceful failure messages, full schema introspection (tables, columns, types, PK/FK, row estimates, sample values), schema summary screen behind login. Also: the messy e-commerce seed script in `/seed`.
**Done when:** signup → login → paste a connection string → see the database's structure rendered, including relationships and sample values. Wrong DB credentials fail with a specific, friendly error. A second user account cannot see or query the first user's connections (verify this explicitly - it is the tenancy test).

### Day 2 - Retrieval
Build: LLM-generated table descriptions at ingest time; `EmbeddingProvider`; embed each table's "name + columns + description + samples" text; store embeddings as float arrays in the app DB; in-memory cosine similarity (own implementation - normalize, dot product); top-k retrieval (k=6) plus FK-neighbor expansion; a debug endpoint/page showing which tables were retrieved for a question and their scores.
**Done when:** typing "what were last month's sales?" against the seed DB retrieves the orders/payments tables and not the support-tickets table, visibly, with scores.

### Day 3 - Generate + validate + execute (single pass)
Build: prompt builder with focused schema context; `LLMProvider`; SQL extraction from LLM output; AST validation (single SELECT only; every table/column exists in SchemaProfile, with offending identifiers named on failure); read-only execution with timeout and row limit; `QueryLog` writing on every attempt.
**Done when:** a well-formed question returns real rows end-to-end in one pass, and a deliberately dangerous prompt ("delete all users") is rejected at validation with the security failure reason logged.

### Day 4 - The self-correction loop
Build: the `loop/` orchestrator - up to 3 attempts, structured failure feedback (failure type + detail + available columns on hallucination), attempt history returned to the frontend, latency recorded per attempt. Harden edge cases: LLM returns prose instead of SQL, returns multiple statements, empty result sets, retrieval finds nothing relevant.
**Done when:** a question that fails on attempt 1 (force it: temporarily poison a column name in the prompt) visibly recovers on attempt 2, and the UI shows "self-corrected after 1 retry."

### Day 5 - Presentation layer + UI pass
Build: deterministic chart selection (stat card / line / bar / scatter / table fallback) with Recharts; raw table always shown; NL explanation call with fenced untrusted data; collapsible SQL display with one-line English description; single UI polish pass (loading states, error states, layout). No new engine features today.
**Done when:** "monthly revenue for the last 6 months" returns a line chart + 2-4 sentence explanation + collapsible SQL, and the whole flow looks presentable in a screen-share.

### Day 6 - Benchmark
Build: 35 benchmark questions against the seed DB in `/seed/benchmark.json`, each with an expected-result checker (expected row count, expected columns, or expected single value - keep checkers simple); a runner script that executes all 35 through the real `/query` endpoint twice - once with the retry loop disabled, once enabled - and outputs a results table (pass/fail, attempts used, failure category, latency); a simple results page or markdown report generator. Categorize failures: retrieval miss / hallucinated identifier / wrong logic / execution error.
**Done when:** a single command produces the accuracy table: one-shot vs with-loop, per-category failure counts.

### Day 7 - Buffer + interview packaging (developer-led; agent assists only)
No new features. Fix anything broken, re-run the benchmark, write README with architecture diagram and benchmark table, record numbers. Developer spends the day reading the codebase end to end and drafting spoken answers.

## Explicitly CUT (do not build, even if trivial)

- Multi-database support (MySQL, SQLite, etc.) - Postgres only.
- Organizations/teams, roles & permissions, invites, OAuth/social login - tenancy is per-user row-level scoping only.
- Conversation memory / follow-up questions referencing prior answers.
- Saved dashboards, query history UI beyond the logs page.
- Streaming responses.
- Schema editing, description editing UI.
- Docker/deployment configuration beyond local dev (deploy only if Day 7 has spare time).
- Any pgvector or external vector database usage.

## The seed database (`/seed/ecommerce.sql`)

A deliberately messy e-commerce schema - realistic ugliness, not tutorial cleanliness:

- `usr` (id, full_nm, email_addr, signup_dt, usr_status)
- `prod_cat` (cat_id, cat_nm, parent_cat_id)
- `products` (prod_id, prod_title, cat_id, unit_price_inr, is_active)
- `ord_hdr` (ord_id, usr_id, ord_dt, ord_status, ship_city)
- `ord_line` (line_id, ord_id, prod_id, qty, line_amt_inr, disc_pct)
- `pay_txn` (txn_id, ord_id, txn_dt, txn_amt_inr, pay_mode, txn_status)
- `support_tix` (tix_id, usr_id, opened_dt, closed_dt, tix_cat, resolution_nm)
- `inventory_snap` (snap_id, prod_id, snap_dt, on_hand_qty)

Seed with ~5k orders across 18 months, mixed statuses (including CANCELLED and REFUNDED - so "revenue" questions have a wrong-but-plausible answer, which the benchmark exploits), inconsistent casing in status values, some NULLs.

## Benchmark question mix (35 total)

- 10 easy single-table ("how many users signed up in 2025?")
- 12 join questions ("top 5 products by revenue")
- 6 ambiguity traps ("what's our revenue?" - must exclude cancelled/refunded, or at least the failure is categorized)
- 4 date-logic questions ("month-over-month order growth")
- 3 irrelevant/adversarial ("delete old users", "what's the weather?", "show me passwords") - expected outcome: safe rejection.