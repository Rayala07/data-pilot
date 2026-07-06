// Raw information_schema / pg_catalog queries used by introspect/index.ts.
// Kept separate from the assembly logic so the SQL is easy to audit on its own.

// Schemas to exclude from introspection: Postgres system schemas plus every
// schema Supabase provisions by default (auth, storage, realtime, vault, ...).
// None of these hold user-created application tables — including them would
// flood the SchemaProfile with auth.users, storage.objects, vault.secrets, etc.
// Confirmed empirically: scanning a fresh Supabase project without this list
// returned 40 tables instead of the ~5 the user actually created.
const EXCLUDED_SCHEMAS = [
  "pg_catalog",
  "information_schema",
  "auth",
  "storage",
  "realtime",
  "_realtime",
  "extensions",
  "graphql",
  "graphql_public",
  "pgbouncer",
  "pgsodium",
  "pgsodium_masking",
  "vault",
  "net",
  "cron",
  "supabase_functions",
  "supabase_migrations",
  "pgtle",
];

const EXCLUDED_SCHEMAS_SQL = EXCLUDED_SCHEMAS.map((s) => `'${s}'`).join(", ");

export const COLUMNS_QUERY = `
  SELECT c.table_schema, c.table_name, c.column_name, c.data_type, c.is_nullable, c.ordinal_position
  FROM information_schema.columns c
  JOIN information_schema.tables t
    ON t.table_schema = c.table_schema AND t.table_name = c.table_name
  WHERE t.table_type = 'BASE TABLE'
    AND t.table_schema NOT IN (${EXCLUDED_SCHEMAS_SQL})
    AND t.table_schema NOT LIKE 'pg\\_%'
  ORDER BY c.table_schema, c.table_name, c.ordinal_position;
`;

// PK/FK deliberately read from pg_catalog, not information_schema.
// information_schema.table_constraints hides rows from a role that only has
// SELECT (its visibility predicate requires INSERT/UPDATE/REFERENCES-type
// privileges) — and DataPilot ALWAYS connects as a read-only, SELECT-only
// role by design (hard rule 1). Confirmed empirically against a real
// read-only role: table_constraints returned zero rows while pg_constraint
// returned all of them. pg_catalog tables have no such privilege gating.
export const PRIMARY_KEY_QUERY = `
  SELECT
    n.nspname AS table_schema,
    c.relname AS table_name,
    a.attname AS column_name,
    ord.ordinality AS ordinal_position
  FROM pg_constraint con
  JOIN pg_class c ON c.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN LATERAL unnest(con.conkey) WITH ORDINALITY AS ord(attnum, ordinality) ON true
  JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ord.attnum
  WHERE con.contype = 'p'
    AND n.nspname NOT IN (${EXCLUDED_SCHEMAS_SQL})
  ORDER BY n.nspname, c.relname, ord.ordinality;
`;

export const FOREIGN_KEY_QUERY = `
  SELECT
    n.nspname AS table_schema,
    c.relname AS table_name,
    a.attname AS column_name,
    rn.nspname AS ref_schema,
    rc.relname AS ref_table,
    ra.attname AS ref_column
  FROM pg_constraint con
  JOIN pg_class c ON c.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_class rc ON rc.oid = con.confrelid
  JOIN pg_namespace rn ON rn.oid = rc.relnamespace
  JOIN LATERAL unnest(con.conkey, con.confkey) WITH ORDINALITY AS ord(attnum, refattnum, ordinality) ON true
  JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ord.attnum
  JOIN pg_attribute ra ON ra.attrelid = rc.oid AND ra.attnum = ord.refattnum
  WHERE con.contype = 'f'
    AND n.nspname NOT IN (${EXCLUDED_SCHEMAS_SQL});
`;

export const ROW_ESTIMATE_QUERY = `
  SELECT
    n.nspname AS table_schema,
    c.relname AS table_name,
    c.reltuples AS row_estimate
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind = 'r'
    AND n.nspname NOT IN (${EXCLUDED_SCHEMAS_SQL})
    AND n.nspname NOT LIKE 'pg\\_%';
`;
