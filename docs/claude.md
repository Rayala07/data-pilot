# DataPilot — Master Context (CLAUDE.md)

> Read this file first. Then read `architecture.md`, `mvp-scope.md`, and `decisions.md` before writing any code. Do not deviate from the scope in `mvp-scope.md` without asking.

## What this project is

DataPilot is a "talk to your database" application. A user connects their PostgreSQL database via a connection string, then asks questions in plain English ("what were last month's sales?"). The system:

1. Introspects the user's database schema once at connect time (tables, columns, types, keys, sample values).
2. On each question, retrieves only the *relevant* tables using embedding similarity (in-memory cosine similarity — NOT a vector database).
3. Generates SQL with an LLM using that focused schema context.
4. Validates the SQL (SELECT-only, all referenced tables/columns actually exist) BEFORE execution.
5. Executes against the user's DB via a read-only connection with timeout and row limit.
6. If execution fails, feeds the error back to the LLM and retries (max 3 attempts total) — this self-correction loop is the centerpiece of the project.
7. Returns: an auto-selected chart, a plain-English explanation of the results, and the executed SQL (visible, collapsible).

## What this project is for

This is a portfolio project built to be **defended in engineering interviews**. Every component exists to solve a named failure mode. Priorities, in order:

1. **Correctness of the engine** (retrieval → generation → validation → execution → retry).
2. **Security layers** (read-only role, SELECT-only parsing, timeouts, row limits).
3. **Measurability** (query logs that feed a benchmark: attempts, errors, retry outcomes, latency).
4. UI polish — last. Functional and clean is enough until Day 5.

## Tech stack (locked — do not substitute)

- **Frontend:** Next.js (App Router) + TypeScript. Plain, clean UI. Tailwind for styling. Recharts for charts.
- **Backend:** Express.js + TypeScript. All engine logic lives here. The Next app only talks to Express over HTTP.
- **App database:** Supabase-hosted PostgreSQL via **Prisma** (pooled connection + `directUrl` for migrations); stores users, connections metadata, schema profiles, embeddings as float arrays, query logs.
- **User's target database:** PostgreSQL via the raw **`pg`** driver, read-only, direct connection (never the pooler), SSL enabled. Prisma NEVER touches the user's database.
- **Similarity search:** in-memory cosine similarity over embedding arrays. NO pgvector, NO vector database. This is deliberate (see `decisions.md`).
- **Auth & tenancy:** email/password with bcrypt + JWT bearer tokens; row-level multi-tenancy — `Connection` and `QueryLog` carry `userId`, every app-DB query is user-scoped. No orgs/roles/OAuth.
- **SQL validation:** `node-sql-parser` (or equivalent AST-based parser). NEVER regex-based validation.
- **LLM + embeddings:** provider-agnostic abstraction (`LLMProvider`, `EmbeddingProvider` interfaces) configured via environment variables against any OpenAI-compatible API. No provider names hardcoded in engine logic.
- **Self-correction loop:** `@langchain/langgraph` — the retry orchestrator is an explicit `StateGraph` (nodes: generate/validate/execute; conditional edges for retry vs. terminate). LangGraph is confined to `engine/loop/`; no other module imports it, and the graph still depends only on the `LLMProvider` interface and an injected `execute` function (see `decisions.md` D15).

## Repository layout

The backend is **feature-based**: the app layer is grouped by domain feature
(`features/auth`, `features/connections`), each owning its own routes,
service, repository, validation, and types. The `engine/` stays a separate
system that features call into — it is NOT a feature. The engine is free of
the web and ORM layers (no Express, no Prisma, no `pg` outside the injected
execute function); the single orchestration dependency, LangGraph, is
confined to `engine/loop/`.

```
datapilot/
├── frontend/                 # Next.js app (UI only — no engine logic ever)
├── backend/                  # Express app
│   ├── src/
│   │   ├── index.ts          # entrypoint: load env + listen
│   │   ├── app.ts            # Express app assembly (createApp), mounts feature routers
│   │   ├── features/         # app layer, grouped by domain feature
│   │   │   ├── auth/         # auth.routes/.service/.repository/.validation/.types/.middleware/.jwt
│   │   │   └── connections/  # connections.routes/.service/.repository/.validation/.types/.errors
│   │   ├── engine/           # ALL core logic lives here, framework-free (NOT a feature)
│   │   │   ├── introspect/   # schema scanning of user DB
│   │   │   ├── retrieval/    # embeddings + cosine similarity
│   │   │   ├── generate/     # prompt building + LLM call
│   │   │   ├── validate/     # AST parse, SELECT-only, schema existence check
│   │   │   ├── execute/      # read-only execution, timeout, row limit
│   │   │   ├── loop/         # retry/self-correction orchestrator (LangGraph StateGraph)
│   │   │   ├── present/      # chart-type selection + NL explanation
│   │   │   └── providers/    # LLMProvider / EmbeddingProvider implementations
│   │   ├── db/               # Prisma client (app DB only)
│   │   ├── userdb/           # pg Pool management for user target DBs
│   │   └── shared/           # cross-cutting primitives (crypto, validation-result type)
│   └── prisma/               # schema.prisma + migrations (app DB)
├── seed/                     # messy e-commerce seed DB (SQL script) + benchmark questions
└── docs/                     # these documents
```

Frontend and backend are fully independent: separate `package.json`, separate `tsconfig.json`, separate dev servers, communicating over HTTP only. The frontend never imports backend code. Prisma lives inside `backend/` since only the backend touches the app database.

Within a feature: `routes` are thin Express adapters; `service` holds orchestration; `repository` is the only place that touches Prisma (and centralizes the `userId` tenancy filter); `validation` and `types` are co-located. `db/` and `userdb/` stay top-level and MUST NOT cross-import — that separation makes the read-only guarantee auditable.

Rule: `engine/` modules must not import Express (or a feature, or Prisma). Feature routes/services are the adapters that call into the engine. This keeps the engine testable and lets the developer explain it as an isolated system in interviews. LangGraph is the one permitted framework inside `engine/`, and only in `loop/`; even there, execution and persistence are injected (an `execute` function and an `onAttempt` callback) so the loop can be unit-tested with stubs and never reaches for I/O itself.

## Coding conventions

- TypeScript strict mode everywhere.
- Every engine module exports typed functions with explicit input/output interfaces. Shared types in `engine/types.ts` (e.g. `SchemaProfile`, `TableProfile`, `ColumnProfile`, `QueryAttempt`, `QueryResult`).
- Errors are values where practical: engine functions return discriminated unions (`{ ok: true, ... } | { ok: false, reason, detail }`) rather than throwing across module boundaries.
- Every query attempt is logged to the app DB: question, retrieved tables, generated SQL, validation result, execution result, error text, attempt number, latency. The benchmark on Day 6 is built entirely from these logs.
- Comments explain *why*, not *what*. The developer will read this entire codebase; write for that reader.
- Small commits with descriptive messages after each working unit.

## Hard rules (never violate)

1. The user's target database is opened with a read-only role and `default_transaction_read_only = on` set on the session. No exceptions.
2. Only statements whose AST root is a single SELECT may be executed. Reject multi-statements, CTEs that write, EXPLAIN ANALYZE with side effects — anything that is not a pure read.
3. Every user-DB query runs with `statement_timeout` (default 15s) and a `LIMIT` cap (default 1000 rows) appended/enforced if absent.
4. Raw values returned from the user's database are treated as untrusted text when passed back into LLM prompts (prompt-injection surface). Truncate long values; never let result rows redefine instructions.
5. Connection strings are secrets: never logged, never returned to the frontend after submission.
6. Every app-DB read/write on `Connection` or `QueryLog` MUST be filtered by the authenticated `userId` — fetching by `id` alone is a tenancy bug. Cross-tenant access returns 404.
7. No feature outside `mvp-scope.md`. If something seems missing, ask instead of building.