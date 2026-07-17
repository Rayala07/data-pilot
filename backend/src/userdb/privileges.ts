// Probes whether the credential the user gave us can actually modify their data.
//
// Hard rule 1 says the target database is opened with a read-only role. Until
// now that was a request in the UI, not a fact we checked - a user could paste
// a superuser string and nothing would say so. This verifies it.
//
// The probe is pure introspection: has_table_privilege and has_schema_privilege
// are functions over the catalog. Nothing is written, and it runs on the same
// read-only session as everything else.
//
// It is informational. The session read-only flag and the AST SELECT-only
// validator still apply whatever this returns - the point is to tell the user
// their credential is stronger than it needs to be, not to rely on it.

import type { Pool } from "pg";
import { getReadOnlyClient } from "./pool";

// `can_create` matters because a role with CREATE on a schema can make its own
// tables and write to those, even with no privileges on existing ones.
// Postgres 15 dropped the legacy PUBLIC CREATE grant on `public`, so this does
// not false-positive on a properly-scoped read-only role (verified against a
// real read-only role: both columns come back false).
const PROBE_SQL = `
  SELECT
    (SELECT COALESCE(bool_or(
        has_table_privilege(c.oid, 'INSERT')
        OR has_table_privilege(c.oid, 'UPDATE')
        OR has_table_privilege(c.oid, 'DELETE')
      ), false)
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE c.relkind = 'r'
       AND n.nspname NOT IN ('pg_catalog', 'information_schema')
       AND n.nspname NOT LIKE 'pg\\_%'
    ) AS can_write_tables,
    (SELECT COALESCE(bool_or(has_schema_privilege(n.nspname, 'CREATE')), false)
     FROM pg_namespace n
     WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
       AND n.nspname NOT LIKE 'pg\\_%'
    ) AS can_create_schema
`;

interface ProbeRow {
  can_write_tables: boolean;
  can_create_schema: boolean;
}

/**
 * Returns true when the credential can write, false when it genuinely cannot,
 * and null when we couldn't tell. Never throws: a failed probe must not fail a
 * connection that is otherwise fine.
 */
export async function probeWriteAccess(pool: Pool): Promise<boolean | null> {
  let client;
  try {
    client = await getReadOnlyClient(pool);
    const res = await client.query<ProbeRow>(PROBE_SQL);
    const row = res.rows[0];
    if (!row) return null;
    return row.can_write_tables || row.can_create_schema;
  } catch {
    return null;
  } finally {
    client?.release();
  }
}
