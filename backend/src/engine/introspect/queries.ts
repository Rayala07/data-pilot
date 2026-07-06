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

export const PRIMARY_KEY_QUERY = `
  SELECT tc.table_schema, tc.table_name, kcu.column_name, kcu.ordinal_position
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
  WHERE tc.constraint_type = 'PRIMARY KEY'
    AND tc.table_schema NOT IN (${EXCLUDED_SCHEMAS_SQL})
  ORDER BY tc.table_schema, tc.table_name, kcu.ordinal_position;
`;

export const FOREIGN_KEY_QUERY = `
  SELECT
    tc.table_schema,
    tc.table_name,
    kcu.column_name,
    ccu.table_schema AS ref_schema,
    ccu.table_name AS ref_table,
    ccu.column_name AS ref_column
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema NOT IN (${EXCLUDED_SCHEMAS_SQL});
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
