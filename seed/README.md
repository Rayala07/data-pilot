# Seed database

`ecommerce.sql` builds a deliberately messy e-commerce schema (8 tables, ~5k
orders over 18 months, mixed-case statuses, some NULLs) and a dedicated
`datapilot_readonly` role. This plays the role of "the user's external
database" in every demo — it should live in its **own, separate** Supabase
project from DataPilot's app DB.

## Loading it

1. Create a new Supabase project (or any empty Postgres 14+ database).
2. Load the script — either:
   - **Supabase SQL editor**: paste the contents of `ecommerce.sql` and run it, or
   - **psql against the direct connection** (port 5432, not the pooler):
     ```
     psql "postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" -f seed/ecommerce.sql
     ```
3. In the Supabase dashboard, go to **Database → Roles**, find `datapilot_readonly`,
   and set a real password (or edit the `CREATE ROLE ... PASSWORD` line before
   running the script). Never leave the placeholder password in a
   long-lived project.
4. Build the connection string DataPilot should use — **as the read-only
   role**, over the **direct** connection (session-level settings like
   `default_transaction_read_only` are only reliable there, never through the
   pooler):
   ```
   postgresql://datapilot_readonly:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   ```
   Paste that into DataPilot's "add connection" form — not the `postgres`
   superuser string.

## Notes

- The script is idempotent for the role creation (`IF NOT EXISTS`) but **not**
  for the data — running it twice against the same database will duplicate
  every row. Load it once per fresh project.
- All dates are generated relative to `CURRENT_DATE`/`CURRENT_TIMESTAMP` at
  load time, so "last month" / "last 18 months" style benchmark questions
  stay meaningful no matter when the script is run.
