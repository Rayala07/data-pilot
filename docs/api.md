# DataPilot Public API (`/v1`)

Machine-to-machine access to DataPilot's engine — connect a PostgreSQL database
and ask questions in plain English, from your own backend. Authenticated by API
key, separate from the web app's user sessions.

Base URL: `https://<your-deployment>` (routes are under `/v1`).

> **Use a read-only database role.** DataPilot only ever runs validated
> `SELECT`s on a read-only session, but for third-party use you should give it a
> credential that *cannot* write in the first place. See "Read-only role" below.

---

## Authentication

1. Sign in to the DataPilot web app and open **API keys**.
2. Create a key. The raw key (`dp_live_…`) is shown **once** — copy it then; it
   is stored only as a hash and can never be retrieved again.
3. Send it as a bearer token on every `/v1` request:

```
Authorization: Bearer dp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

A missing, malformed, unknown, or revoked key all return the same `401` — the
API never reveals which. Revoke a key from the same page; it stops working
immediately. A revoked key can then be deleted to remove it from the list
(deletion is only allowed after revocation, so a live key can't vanish out from
under whatever is using it).

The API-key and web-session (JWT) systems are independent: a web JWT is rejected
on `/v1`, and an API key is rejected on the web routes.

---

## Endpoints

### `POST /v1/connections` — register a database

Opens the database read-only, introspects its schema, and builds the retrieval
index. This does real work (introspection + embeddings) and may take 20–40s.

```bash
curl -X POST https://<host>/v1/connections \
  -H "Authorization: Bearer $DP_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production analytics",
    "connectionString": "postgresql://readonly:***@db.example.com:5432/app"
  }'
```

```json
{ "connectionId": "3f2c…", "name": "Production analytics", "tableCount": 8 }
```

### `GET /v1/connections` — list your connections

```bash
curl https://<host>/v1/connections -H "Authorization: Bearer $DP_KEY"
```

```json
[
  { "id": "3f2c…", "name": "Production analytics", "tableCount": 8, "scannedAt": "2026-01-12T09:30:00.000Z" }
]
```

### `POST /v1/query` — ask a question

Runs the full pipeline: relevant-table retrieval → SQL generation → AST
validation → read-only execution → self-correction (up to 3 attempts) →
presentation.

```bash
curl -X POST https://<host>/v1/query \
  -H "Authorization: Bearer $DP_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "connectionId": "3f2c…", "question": "top 5 products by revenue last month" }'
```

```json
{
  "rows": [{ "product": "Widget", "revenue": "48210.00" }],
  "fields": [{ "name": "product", "kind": "text" }, { "name": "revenue", "kind": "numeric" }],
  "rowCount": 5,
  "chart": { "type": "bar", "xField": "product", "yField": "revenue" },
  "explanation": "The five highest-grossing products last month…",
  "sql": "SELECT p.prod_title AS product, SUM(...) ...",
  "attempts": [
    { "attemptNumber": 1, "sql": "SELECT …", "retrievedTables": ["ord_line","products"], "latencyMs": 2140 }
  ],
  "usage": { "attemptsUsed": 1 }
}
```

`fields[].kind` is one of `numeric | date | boolean | text`. `chart.type` is one
of `stat | line | bar | scatter | table`. `attempts` is the self-correction
trail — more than one entry means the engine recovered from an earlier failure.

### `DELETE /v1/connections/:id` — remove a connection

Deletes the connection and its stored schema profile and query logs.

```bash
curl -X DELETE https://<host>/v1/connections/3f2c… -H "Authorization: Bearer $DP_KEY"
```

```json
{ "deleted": true }
```

---

## Errors

Every `/v1` error uses one shape:

```json
{ "error": { "code": "not_found", "message": "Connection not found" } }
```

| HTTP | `code` | When |
|------|--------|------|
| 400 | `bad_request` | Missing/invalid body fields. |
| 401 | `unauthorized` | Missing, malformed, unknown, or revoked API key. |
| 404 | `not_found` | Connection doesn't exist **or belongs to another key's owner**, or isn't scanned yet. |
| 422 | `connection_failed` | The database couldn't be reached / authenticated / introspected. |
| 422 | `query_failed` | The engine ran but couldn't produce a usable answer (retries exhausted, or a request that was refused for safety). Includes `failureType`, `sql`, and `attempts`. |
| 429 | `rate_limited` | A rate limit was hit. Includes `retryAfterSeconds`. |
| 500 | `internal` | Unexpected server error. No internal detail is ever exposed. |

A **`query_failed`** body keeps the attempt trail so you can see what was tried:

```json
{
  "error": { "code": "query_failed", "message": "Unknown column(s): revenu…" },
  "failureType": "hallucination",
  "sql": "SELECT revenu FROM …",
  "attempts": [ { "attemptNumber": 1, "failureType": "hallucination", "errorText": "…" } ]
}
```

Note the distinction: a query that **runs and returns zero rows is a success**
(`200`, `rows: []`), not an error.

---

## Rate limits

Per API key:

- **20 requests / minute** across all `/v1` routes.
- **200 queries / day** for `POST /v1/query`.

Over a limit → `429`:

```json
{ "error": { "code": "rate_limited", "message": "Daily query limit exceeded: at most 200 queries per day." }, "retryAfterSeconds": 41231 }
```

A `Retry-After` header carries the same value. (Deployment operators can adjust
the limits with `API_RATE_LIMIT_PER_MIN` and `API_QUERY_LIMIT_PER_DAY`.)

---

## Read-only role (recommended)

Create a Postgres role that can only read, and use *its* connection string:

```sql
CREATE ROLE datapilot_readonly WITH LOGIN PASSWORD 'choose-a-strong-password';
GRANT USAGE ON SCHEMA public TO datapilot_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO datapilot_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO datapilot_readonly;
```

DataPilot also verifies at connect time whether the supplied credential can
write, so you can confirm it is genuinely read-only.
