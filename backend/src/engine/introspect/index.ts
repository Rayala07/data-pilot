// Schema introspection: scans the user's target database via system catalogs
// and assembles a SchemaProfile. Framework-free - takes a pg Pool, never
// opens a connection itself (that is userdb/'s job).

import type { Pool } from "pg";
import type { ColumnProfile, ForeignKeyProfile, Result, SchemaProfile, TableProfile } from "../types";
import { getReadOnlyClient } from "../../userdb/pool";
import { COLUMNS_QUERY, FOREIGN_KEY_QUERY, PRIMARY_KEY_QUERY, ROW_ESTIMATE_QUERY } from "./queries";

const SAMPLE_VALUE_TIMEOUT_MS = 3000;
const SAMPLE_VALUE_MAX_LENGTH = 120;
const SAMPLE_VALUE_COUNT = 5;

interface ColumnRow {
  table_schema: string;
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: "YES" | "NO";
}

interface PrimaryKeyRow {
  table_schema: string;
  table_name: string;
  column_name: string;
}

interface ForeignKeyRow {
  table_schema: string;
  table_name: string;
  column_name: string;
  ref_schema: string;
  ref_table: string;
  ref_column: string;
}

interface RowEstimateRow {
  table_schema: string;
  table_name: string;
  row_estimate: number;
}

function tableKey(schema: string, name: string): string {
  return `${schema}.${name}`;
}

// Postgres identifiers can contain arbitrary characters when quoted at creation time;
// double-quote and escape before interpolating into the sample-value queries below.
function quoteIdent(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}…` : value;
}

export async function introspectSchema(pool: Pool, connectionId: string): Promise<Result<SchemaProfile>> {
  const client = await getReadOnlyClient(pool);
  try {
    const [columnsRes, pkRes, fkRes, rowEstRes] = await Promise.all([
      client.query<ColumnRow>(COLUMNS_QUERY),
      client.query<PrimaryKeyRow>(PRIMARY_KEY_QUERY),
      client.query<ForeignKeyRow>(FOREIGN_KEY_QUERY),
      client.query<RowEstimateRow>(ROW_ESTIMATE_QUERY),
    ]);

    const tables = new Map<string, TableProfile>();

    for (const row of columnsRes.rows) {
      const key = tableKey(row.table_schema, row.table_name);
      let table = tables.get(key);
      if (!table) {
        table = {
          schema: row.table_schema,
          name: row.table_name,
          rowEstimate: 0,
          columns: [],
          primaryKey: [],
          foreignKeys: [],
          description: "",
        };
        tables.set(key, table);
      }
      const column: ColumnProfile = {
        name: row.column_name,
        dataType: row.data_type,
        nullable: row.is_nullable === "YES",
        sampleValues: [],
      };
      table.columns.push(column);
    }

    for (const row of pkRes.rows) {
      tables.get(tableKey(row.table_schema, row.table_name))?.primaryKey.push(row.column_name);
    }

    for (const row of fkRes.rows) {
      const fk: ForeignKeyProfile = {
        column: row.column_name,
        refTable: row.ref_table,
        refColumn: row.ref_column,
      };
      tables.get(tableKey(row.table_schema, row.table_name))?.foreignKeys.push(fk);
    }

    for (const row of rowEstRes.rows) {
      const table = tables.get(tableKey(row.table_schema, row.table_name));
      if (table) table.rowEstimate = Math.max(0, Math.round(Number(row.row_estimate)));
    }

    // Sample values run sequentially with a short statement_timeout so any
    // column that fails (timeout, permission, exotic type) is skipped rather
    // than failing the whole scan.
    await client.query(`SET statement_timeout = ${SAMPLE_VALUE_TIMEOUT_MS}`);
    for (const table of tables.values()) {
      for (const column of table.columns) {
        try {
          const res = await client.query(
            `SELECT DISTINCT ${quoteIdent(column.name)} AS v FROM ${quoteIdent(table.schema)}.${quoteIdent(table.name)} WHERE ${quoteIdent(column.name)} IS NOT NULL LIMIT ${SAMPLE_VALUE_COUNT}`
          );
          column.sampleValues = res.rows.map((r) => truncate(String(r.v), SAMPLE_VALUE_MAX_LENGTH));
        } catch {
          column.sampleValues = [];
        }
      }
    }
    await client.query("RESET statement_timeout");

    return {
      ok: true,
      value: {
        connectionId,
        scannedAt: new Date().toISOString(),
        tables: Array.from(tables.values()),
      },
    };
  } catch (err) {
    return { ok: false, reason: "introspection_error", detail: (err as Error).message };
  } finally {
    client.release();
  }
}
