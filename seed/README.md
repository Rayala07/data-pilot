# Seed database

`ecommerce.sql` builds a deliberately messy e-commerce schema (8 tables, ~5k
orders over 18 months, mixed-case statuses, some NULLs) and a dedicated
`datapilot_readonly` role. This plays the role of "the user's external
database" in every demo, so give it its **own, separate database** — keep it
isolated from DataPilot's own app DB.

Any Postgres 14+ works: a local instance, or a fresh project on any managed
Postgres host.

## Loading it

1. Create an empty Postgres 14+ database.

2. Run `ecommerce.sql` against it, either way:
   - **Browser SQL editor / query console** (most managed hosts have one):
     paste the contents of `ecommerce.sql` and run it, or
   - **psql**, pointed at the database as an admin user:
     ```
     psql "postgresql://<admin-user>:<password>@<host>:5432/<database>" -f seed/ecommerce.sql
     ```

3. Give the read-only role a real password. The script creates it with a
   placeholder, so either edit the `CREATE ROLE datapilot_readonly ... PASSWORD
   'CHANGE_ME_BEFORE_USE'` line **before** running, or run this **after**:
   ```
   ALTER ROLE datapilot_readonly PASSWORD 'a-strong-password';
   ```
   Never leave the placeholder in a long-lived database.

4. Build the connection string DataPilot connects with — as the
   **`datapilot_readonly`** role, not the admin/superuser one:
   ```
   postgresql://datapilot_readonly:<password>@<host>:5432/<database>
   ```
   The easy way: take the database's own connection string and swap the
   username and password for the read-only role, keeping its host, database,
   and any `?sslmode=...` parameters. Paste that into DataPilot's "add
   connection" form.

   Use a **direct** (session-mode) connection, not a **transaction pooler**:
   DataPilot sets `default_transaction_read_only` on the session and runs
   several introspection queries on it, which a pooler can route to different
   backends and lose. A string is pooled if its host or parameters contain
   `pooler`, `pgbouncer`, or `pool`, or it uses a pooling-only port such as
   `6543`. If your host lists two strings, pick the one labelled **Direct** or
   **Session**.

## Notes

- The script is idempotent for the role creation (`IF NOT EXISTS`) but **not**
  for the data — running it twice against the same database duplicates every
  row. Load it once per fresh database.
- All dates are generated relative to `CURRENT_DATE` / `CURRENT_TIMESTAMP` at
  load time, so "last month" / "last 18 months" style benchmark questions stay
  meaningful no matter when the script is run.
