// Execute: runs an already-validated SELECT against the user's database under
// the execution-level safety limits (hard rule 3). Read-only is enforced two
// ways — the connection uses a read-only role, and getReadOnlyClient sets the
// session read-only flag — so this layer only adds the timeout and row cap.

import type { Pool } from "pg";
import { getReadOnlyClient } from "../../userdb/pool";
import type { FieldMeta } from "../types";
import { kindForOid } from "./pgTypes";

const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_MAX_ROWS = 1000;

export type ExecuteOutcome =
  | { ok: true; rows: Record<string, unknown>[]; fields: FieldMeta[]; rowCount: number }
  | { ok: false; detail: string };

export interface ExecuteOptions {
  timeoutMs?: number;
  maxRows?: number;
}

export async function executeSelect(pool: Pool, sql: string, opts: ExecuteOptions = {}): Promise<ExecuteOutcome> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRows = opts.maxRows ?? DEFAULT_MAX_ROWS;

  const client = await getReadOnlyClient(pool);
  try {
    await client.query(`SET statement_timeout = ${timeoutMs}`);
    // Wrap rather than parse-and-rewrite: this caps rows regardless of the
    // query's own LIMIT (or absence of one) without touching the validated SQL.
    // A subquery in FROM may itself be a full SELECT (incl. WITH/ORDER BY),
    // so wrapping is safe for anything validation already accepted.
    const wrapped = `SELECT * FROM (${sql}) AS _dp_sub LIMIT ${maxRows}`;
    const res = await client.query(wrapped);
    return {
      ok: true,
      rows: res.rows,
      // Carry the column's semantic kind, not just its name — chart selection
      // depends on it and it cannot be recovered from the values.
      fields: res.fields.map((f) => ({ name: f.name, kind: kindForOid(f.dataTypeID) })),
      rowCount: res.rowCount ?? res.rows.length,
    };
  } catch (err) {
    return { ok: false, detail: (err as Error).message };
  } finally {
    client.release();
  }
}
