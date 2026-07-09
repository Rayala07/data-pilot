# DataPilot — Day 1 Ownership

Written to be *defended out loud*. Everything here covers Day 1 excluding the auth
implementation (signup/login, JWT middleware, bcrypt, ownership helper).

> **Note on file paths.** Commit `9cf3874 "Restructure backend into feature-based modules"`
> moved this code after Day 1 was written. `routes/connections.ts` was split into six files
> under `features/connections/` (`.routes` / `.service` / `.repository` / `.validation` /
> `.types` / `.errors`), `lib/crypto.ts` → `shared/crypto.ts`, `lib/ownership.ts` →
> `connections.repository.ts::getOwnedConnection`, `middleware/requireAuth.ts` →
> `features/auth/auth.middleware.ts`, and `index.ts` split into `app.ts` + `index.ts`.
> The paths below are the **current** ones. `engine/` and `userdb/` never moved.

---

## 1. The architecture, in one sentence

> **Day 1 is a thin authenticated HTTP layer over a framework-free introspection engine
> that turns a user's Postgres connection string into a persisted, encrypted SchemaProfile
> — with a hard, auditable wall between the app DB (Prisma, trusted) and the user's DB
> (raw `pg`, read-only, untrusted).**

The three ideas that sentence must carry:

1. **Thin routes, fat engine.** `routes/` are adapters. All real logic is in `engine/`,
   which imports neither Express nor Prisma, so it can be explained (and tested) as an
   isolated system.
2. **The core transform.** connection string → `SchemaProfile`. That's the entire product
   on Day 1.
3. **The two-database wall.** DataPilot's own notebook (app DB, Prisma, read/write) is a
   different thing from the user's cabinet (user DB, raw `pg`, read-only, unknown, untrusted).
   Nothing in `userdb/` imports Prisma. Nothing in `db/` opens a user connection.

**Key vocabulary.** A `SchemaProfile` is the *structure* of the user's tables — columns,
types, keys, row estimates — plus **at most 5 truncated sample values per column**. It is
**never** a copy of the user's data. (Say this precisely: "structure plus a few sample
values, never the rows.")

---

## 2. The trace: one connection string, hop by hop

| # | Hop | File | The decision | Breaks without it |
|---|---|---|---|---|
| 1 | Form submit | `frontend/src/app/connections/page.tsx` | Browser never opens a DB; it JSON-encodes the string and posts it. UI holds zero engine logic. | Engine logic leaks into the client; DB credentials/keys would have to live in the browser. |
| 2 | Fetch wrapper | `frontend/src/lib/api.ts` | One choke point attaches the `Bearer` token and normalizes errors into `ApiError`. | Every screen re-implements auth headers; one forgets; errors surface as raw JSON. |
| 3 | Auth gate | `features/connections/connections.routes.ts` (`.use(requireAuth)`) | Cheapest, most decisive rejection runs first — before any payload inspection. | Unauthenticated requests reach body parsing and route logic. |
| 4 | Body check | `features/connections/connections.validation.ts` | Deliberately dumb: presence + type only. No regex on the connection string — the *real* test is whether it connects. | Either fragile format regexes that reject valid strings, or `undefined` reaching `new Pool()`. |
| 5 | Open the user DB | `userdb/pool.ts` → `connectAndValidate` | Raw `pg`, not Prisma (unknown schema). A `Pool` capped at 3. `pool.on("error", noop)` so a dropped idle socket can't crash the process. | Prisma can't model an unknown schema; an uncapped pool lets one user DB exhaust the server; an idle-connection error takes down the API. |
| 6 | Lock it down | `userdb/pool.ts` → `getReadOnlyClient` | `SET default_transaction_read_only = on` **on every checkout**, not once at pool creation — pooled physical connections are recycled. | A recycled connection is handed out **without** the read-only flag. Silent write hole. |
| 7 | Prove it's alive | `userdb/pool.ts` (`SELECT 1`) + `classifyConnectionError` | Cheapest possible query. Its error code maps to a typed `FailureReason` (`unreachable` / `bad_credentials` / `not_postgres`). | Failures are indistinguishable; the user gets a stack trace instead of "wrong password". |
| 8 | Encrypt at rest | `shared/crypto.ts` → `encrypt` | AES-256-GCM. Stores **three** pieces: `cipherText`, a fresh random `iv` per encrypt, and an auth `tag`. The **key lives in env, never in the DB**. | DB theft yields plaintext credentials. Without the IV, identical strings encrypt identically. Without the tag, tampering is undetectable. |
| 9 | Save the connection | `connections.service.ts::createAndScan` → `connections.repository.ts::createConnection` | Persist **only after** the connect-test passes, so the notebook only ever holds known-good connections. | The app DB fills with dead rows for typos and wrong passwords; the connections list shows garbage. |
| 10 | Scan the structure | `engine/introspect/index.ts` + `queries.ts` | Ask Postgres's **own catalog**, never `SELECT *`. Four queries in `Promise.all`. **Columns from `information_schema`; PK/FK/row-estimate from `pg_catalog`.** Row count uses `pg_class.reltuples` (an estimate), not `COUNT(*)`. | `SELECT *` drags gigabytes over the wire and still can't tell you types or keys. `information_schema` **hides constraints from a SELECT-only role** — PK/FK come back empty. `COUNT(*)` on 50M rows is unusable. |
| 11 | Sample values, carefully | `engine/introspect/index.ts` | `SET statement_timeout = 3000` + per-column `try/catch` + `SELECT DISTINCT … WHERE … IS NOT NULL LIMIT 5` + `truncate(…, 120)` + `quoteIdent()`. Runs **sequentially**, unlike the parallel catalog queries. | One 50M-row table hangs the entire scan. One exotic column kills all 8 tables. A 10KB blob bloats the profile and, later, the LLM prompt. Unquoted identifiers break on odd names and open an injection seam. Parallel firing hammers a DB you don't own. |
| 12 | Persist + respond + render | `connections.repository.ts::saveSchemaProfile`, `connections.routes.ts`, `[id]/page.tsx` | `upsert` (rescan replaces the profile whole). `pool.end()` in a `finally` — Day 1 holds **no** long-lived user-DB connection. Response returns `{ id, name, tableCount }` — **never** the connection string. | `create` throws on rescan. Leaked connections to the user's DB on every scan. Secrets echo back to the client. |

> **Day 2 note.** `introspectAndPersist` (now in `connections.service.ts`) gained one
> best-effort `enrichSchemaProfile(...)` call between hop 11 and hop 12, which adds an LLM
> `description` and a normalized `embedding` to every table before persistence. Nothing else in
> this trace changed. See `day2-ownership.md`.

**The whole life of the string, in one breath:** form → `apiFetch` (Bearer) → auth gate →
body check → `connectAndValidate` (raw `pg`, read-only switch, `SELECT 1`) → `encrypt`
(3 pieces) → save connection → `introspectSchema` (4 catalog queries + guarded sample reads)
→ assemble `SchemaProfile` → save to app DB → `pool.end()` → return `tableCount` → frontend
fetches `/:id/schema` and draws the grid.

---

## 3. Deviations from `docs/architecture.md` — know these before someone finds them

Interviews are won by naming your own gaps first.

1. **Column defaults are documented but not captured.** `architecture.md` Flow 1 says
   "Columns: name, data type, nullability, **default**." `COLUMNS_QUERY` selects no
   `column_default`, and `ColumnProfile` has no such field. Either the doc is stale or
   the feature is missing — say so plainly.
2. **"Direct connection, never the pooler" is not enforced.** `CLAUDE.md` requires it
   (session settings like `default_transaction_read_only` are unreliable through a
   transaction pooler). Nothing in the code checks the port or host. It relies entirely
   on the user pasting the right string, guided by a form placeholder. **This is the same
   gap that makes the read-only role optional in practice.**
3. **`ssl: { rejectUnauthorized: false }`.** DataPilot accepts the database's certificate
   without verifying it against a CA. Needed for Supabase's self-signed certs; the honest
   cost is that a man-in-the-middle with a forged cert would not be detected.
4. **`ENCRYPTION_KEY` is validated lazily.** `getKey()` throws only when `encrypt`/`decrypt`
   is first called — not at boot. A misconfigured deploy looks healthy until the first user
   tries to add a connection.
5. **Excluded schemas go far beyond the doc.** The doc says exclude `pg_catalog` and
   `information_schema`. The code excludes ~17 schemas (every schema Supabase provisions).
   Confirmed empirically: without the list, a fresh Supabase project reported **40 tables
   instead of ~5**. This is an improvement over the doc, and it has a war story attached — use it.
6. **A connection row can exist without a schema profile.** `POST /connections` saves the
   connection, *then* scans. If the scan fails it returns `422` **with the `id`**, leaving an
   unscanned connection. Deliberate — it's what makes `POST /:id/rescan` useful — and the
   read path handles it (`tableCount: 0`, and `GET /:id/schema` returns 404 "not scanned yet").

---

## 4. My three weakest answers, corrected

### ❌ "The frontend encrypts the connection string to stop man-in-the-middle attacks."

**Why it's wrong:** it merges two unrelated mechanisms. Encryption **in transit** is TLS/HTTPS —
handled by the transport layer, not application code. Encryption **at rest** is the AES-256-GCM
in `shared/crypto.ts`, and it runs on the **backend** before storage. Decisive proof the frontend
can't do it: at-rest encryption needs `ENCRYPTION_KEY`, and shipping that key to every browser
would put it one DevTools panel away from any attacker.

> ✅ **"In transit it's protected by HTTPS. The app-level AES-256-GCM encryption is at-rest, on
> the backend, because the encryption key can never touch the browser."**

### ❌ "A SchemaProfile holds the description of all the table *data*."

**Why it's wrong:** one word — *data*. It invites the instant kill-shot: *"So you copied a
50-million-row table into your app?"* The profile holds **structure**: columns, types,
nullability, primary keys, foreign keys, row *estimates* — plus at most **5 sample values per
column, each truncated to 120 chars.**

> ✅ **"A SchemaProfile is the tables' structure — columns, types, keys, sizes — plus five
> truncated sample values per column. Bytes, not gigabytes. We never copy the user's rows."**

### ❌ "If you delete the read-only line, we should add a validation layer to counter DELETE/DROP."

**Why it's wrong:** it answers *"what would you build?"* when the question was *"what is your
exposure right now?"* Never answer a threat-model question with a roadmap. It's also factually
off: the AST validator is **Day 3**, doesn't exist yet, and is an *app*-level layer — the
question was about the *database* level.

> ✅ **"Two independent locks protect the user's data: the read-only role and the session flag.
> Removing the flag is survivable for a user who pasted a read-only role — that's precisely what
> defense in depth buys. But we never *enforce* that they do. For a user who pasted a superuser
> string, the session flag was the only lock, and their data is now writable. The exposure is
> exactly the population where the other layer was never in place."**

---

## 5. Five spoken openers to rehearse out loud

Say each one until it's boring. First person, ≤2 sentences.

1. **"Walk me through what happens when a user connects a database."**
   > "The browser posts the connection string to Express, which authenticates the user, then opens
   > a raw `pg` pool and immediately sets `default_transaction_read_only` on the session before
   > running a `SELECT 1` to prove the database is real. Only then do we AES-encrypt the string,
   > save it, and scan the schema."

2. **"Why two different database clients?"**
   > "Our own schema is known and stable, so Prisma's type safety pays off; the user's schema is
   > arbitrary and untrusted, so an ORM buys nothing and introspection needs raw catalog SQL.
   > Splitting them means exactly one auditable module can touch a user's database, and it
   > hard-codes the read-only flag."

3. **"How do you guarantee you never write to a user's database?"**
   > "Two independent locks: they connect as a `SELECT`-only role, and every single connection
   > checkout sets `default_transaction_read_only = on` at the session level. It's set per-checkout
   > rather than once, because a pool recycles physical connections and one could otherwise be
   > handed out without the flag."

4. **"Why `pg_catalog` instead of `information_schema` for keys?"**
   > "Because `information_schema` gates constraint visibility on write privileges, and we always
   > connect as a read-only role — I tested it, and it returned zero primary keys. `pg_catalog` has
   > no such privilege filter, so that's where the PK and FK queries read from."

5. **"What stops introspection from hanging on a huge database?"**
   > "Structure comes from Postgres's own catalog, so we read zero user rows — `reltuples` gives a
   > row estimate instead of a `COUNT(*)`. Sample values are the only real reads, and they're capped
   > by a 3-second `statement_timeout` with a per-column try/catch, so a slow column degrades to
   > empty samples instead of failing the scan."
