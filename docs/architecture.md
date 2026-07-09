# DataPilot — Architecture

## The two-database rule (most important concept in the system)

DataPilot touches two entirely different kinds of PostgreSQL databases and must never confuse them:

| | App DB | User's target DB |
|---|---|---|
| Purpose | DataPilot's own storage | The database the user wants to query |
| Access | Prisma ORM | Raw `pg` driver only |
| Permissions | Full read/write | **Read-only role + session-level read-only flag** |
| Contents | connections, schema profiles, embeddings, query logs | Unknown; treated as untrusted |
| Code location | `backend/src/db/` | `backend/src/userdb/` |

Nothing in `userdb/` imports Prisma. Nothing in `db/` opens user connections.

## Authentication & multi-tenancy

- **Auth:** email/password. Passwords hashed with bcrypt (cost 10+). Login issues a JWT (secret from env, 7-day expiry) sent as a Bearer token. An Express `requireAuth` middleware verifies the token and attaches `req.userId`; every route except `POST /auth/signup` and `POST /auth/login` sits behind it.
- **Tenancy model:** row-level scoping by `userId`. `User` is a first-class Prisma model; `Connection` and `QueryLog` each carry a required `userId` foreign key. **Every** Prisma query on these tables includes the `userId` filter — never fetch by `id` alone. Ownership checks happen in one place: a `getOwnedConnection(userId, connectionId)` helper that all routes use; a miss returns 404 (not 403, to avoid leaking existence).
- **Deliberately out of scope:** organizations/teams, roles, invites, OAuth. Tenancy here means strict per-user data isolation, nothing more.

## Components

```
Browser (Next.js)
   │  HTTP/JSON
   ▼
Express API (backend/)
   ├── routes/connections   POST /connections, GET /connections/:id/schema
   ├── routes/query          POST /query
   │
   └── engine/
        ├── introspect/    ── scans user DB → SchemaProfile
        ├── retrieval/     ── embeds tables + question, cosine top-k
        ├── generate/      ── builds prompt, calls LLMProvider → SQL
        ├── validate/      ── AST parse → SELECT-only + schema existence
        ├── execute/       ── runs SQL on user DB (timeout, row limit)
        ├── loop/          ── orchestrates generate→validate→execute→retry
        ├── present/       ── chart-type selection + NL explanation
        └── providers/     ── OpenAI-compatible LLM + embedding clients
```

## Flow 1 — Connect & introspect (Day 1)

1. `POST /connections` with `{ connectionString, name }`.
2. Backend opens a `pg` connection, sets `default_transaction_read_only = on`, runs `SELECT 1` to validate. Failure → structured error (bad credentials / unreachable host / not postgres), returned gracefully.
3. Introspection queries (against `information_schema` and `pg_catalog`):
   - Tables in user-visible schemas (exclude `pg_catalog`, `information_schema`).
   - Columns: name, data type, nullability, default.
   - Primary keys, foreign keys (source table/column → target table/column).
   - Approximate row count per table (`pg_class.reltuples`).
   - Sample values: for each column, up to 5 distinct non-null values via `SELECT DISTINCT col FROM tbl LIMIT 5` (with per-query timeout; skip on failure). Truncate each value to 120 chars.
4. Result assembled into a `SchemaProfile` JSON and stored in the app DB via Prisma. The connection string is stored encrypted-at-rest (AES-256-GCM with key from env) and never sent back to the client.
5. Frontend renders a schema summary: tables, columns, relationships, row counts.

### SchemaProfile shape (canonical type, `engine/types.ts`)

```ts
interface SchemaProfile {
  connectionId: string;
  scannedAt: string;
  tables: TableProfile[];
}
interface TableProfile {
  schema: string;            // e.g. "public"
  name: string;
  rowEstimate: number;
  columns: ColumnProfile[];
  primaryKey: string[];
  foreignKeys: { column: string; refTable: string; refColumn: string }[];
  description: string;       // generated once at ingest: LLM-written 1-2 line summary of what the table appears to hold
  embedding?: number[];      // filled by retrieval module (Day 2)
}
interface ColumnProfile {
  name: string;
  dataType: string;
  nullable: boolean;
  sampleValues: string[];
}
```

The `description` field matters: embeddings of "name + columns + description + sample values" retrieve far better than embeddings of bare table names like `usr_txn_v2`.

## Flow 2 — Ask a question (Days 2–4)

`POST /query` with `{ connectionId, question }` → the **loop** orchestrator:

```
question
  │
  ▼
[retrieval]  embed(question) → cosine vs each table embedding → top-k tables (k=6, plus any tables FK-linked to the top-3)
  │
  ▼
[generate]   prompt = system rules + focused schema context (only retrieved tables) + question (+ on retry: previous SQL + error)
  │           → LLMProvider → candidate SQL
  ▼
[validate]   parse to AST (node-sql-parser)
  │            ├─ not parseable            → fail(validation)
  │            ├─ root not single SELECT   → fail(security)
  │            └─ any table/column not in SchemaProfile → fail(hallucination), with the offending identifiers named
  ▼
[execute]    run on user DB: read-only session, statement_timeout=15s, enforce LIMIT ≤ 1000
  │            ├─ DB error → fail(execution) with pg error text
  │            └─ success  → rows + fields
  ▼
on hallucination/validation/execution fail: attempt++ ; if attempt ≤ 3 → back to [generate] with structured failure feedback
on security fail: STOP immediately — never retried, never executed (see D7a)
on success or attempts exhausted → [present]
```

An empty result set is a valid answer, not a failure — it is never retried.

Every attempt (successful or not) is written to `QueryLog` in the app DB. This log IS the benchmark data source.

### Retry feedback format (given back to the LLM verbatim, structured)

```
Your previous SQL failed.
SQL: <previous sql>
Failure type: hallucination | validation | execution
Detail: column "usr_name" does not exist on table "users". Available columns: id, full_name, email, created_at, ...
Fix the query. Return only SQL.
```

Naming the available columns on hallucination failures is what makes retries actually converge — this detail is worth calling out in interviews.

## Flow 3 — Presentation (Day 5)

`present/` receives `{ rows, fields, sql, question }` and produces:

1. **Chart selection** — deterministic rules, not LLM:
   - 1 row × 1 numeric column → stat card.
   - date/timestamp column + numeric column(s) → line chart (time ascending).
   - 1 text/categorical column + 1 numeric column, ≤ 30 rows → bar chart.
   - 2 numeric columns, > 30 rows → scatter.
   - anything else → table only.
   Always render the raw table beneath the chart.
2. **NL explanation** — one LLM call: given the question, the SQL, and up to the first 50 rows (values truncated), write 2–4 sentences explaining what the data shows. Result rows are untrusted input: they are wrapped in a delimited data block in the prompt with an instruction that content inside is data, never instructions.
3. **SQL display** — the executed SQL plus a one-line English description of what it does, shown collapsed under the answer.

## API contract (all endpoints)

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | /auth/signup | `{ email, password }` | `{ token }` |
| POST | /auth/login | `{ email, password }` | `{ token }` |
| POST | /connections | `{ name, connectionString }` | `{ id, name, tableCount }` or structured error |
| GET | /connections | — | list (id, name, tableCount, scannedAt) |
| GET | /connections/:id/schema | — | SchemaProfile (without connection string) |
| POST | /connections/:id/rescan | — | refreshed SchemaProfile |
| POST | /query | `{ connectionId, question }` | `{ answer: { explanation, chart, rows, fields, sql }, attempts: QueryAttempt[] }` |
| GET | /logs?connectionId= | — | query logs (for the benchmark page) |

All routes except the two `/auth` endpoints require `Authorization: Bearer <jwt>` and are scoped to the authenticated user's data; requesting another user's connection returns 404.

`attempts` is returned to the frontend on purpose: the UI can show "self-corrected after 1 retry", which demos the loop visibly.

## Security layers (defense in depth — interview answer, verbatim)

1. **DB-level:** read-only role + `default_transaction_read_only = on`. Even a validation bypass cannot write.
2. **App-level:** AST parse; only a single pure SELECT survives. Regex is explicitly forbidden (trivially bypassable: comments, casing, nesting).
3. **Execution-level:** `statement_timeout` 15s, row limit 1000, per-connection pool caps so one user DB can't exhaust the server.
4. **LLM-level:** result values re-entering prompts are truncated and fenced as data (prompt-injection mitigation).
5. **Tenant isolation:** JWT auth on every route; all app-DB reads/writes filtered by `userId` via a single ownership helper — cross-tenant requests 404.
6. **Secrets:** connection strings encrypted at rest, never logged, never re-sent to clients; password hashes via bcrypt, JWT secret from env.

## Error handling philosophy

Every failure the user can cause has a friendly, specific message: unreachable host, wrong password, not a Postgres server, empty database, question retrieved zero relevant tables ("I couldn't find tables related to that — here's what this database contains…"), all retries exhausted (show the last SQL + last error honestly, never fake an answer).