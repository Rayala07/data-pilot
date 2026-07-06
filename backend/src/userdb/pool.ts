// Manages pg Pools against the user's target database. This is the only module
// in the codebase permitted to open a connection to a user-supplied database.
// Nothing here imports Prisma; nothing in db/ imports this.

import { Pool, type PoolClient } from "pg";
import type { FailureReason, Result } from "../engine/types";

const MAX_POOL_CLIENTS = 3;

function classifyConnectionError(err: unknown): FailureReason {
  const code = (err as { code?: string } | undefined)?.code;
  const message = (err as Error | undefined)?.message ?? "";

  if (code === "ENOTFOUND" || code === "ECONNREFUSED" || code === "ETIMEDOUT" || code === "EHOSTUNREACH") {
    return "unreachable";
  }
  if (code === "28P01" || code === "28000" || /password authentication failed/i.test(message)) {
    return "bad_credentials";
  }
  if (/does not support ssl/i.test(message) || /server does not support ssl/i.test(message)) {
    return "unreachable";
  }
  // Anything else at connect/SELECT-1 time (protocol errors, unexpected server
  // greeting, etc.) most likely means the host isn't a Postgres server at all.
  return "not_postgres";
}

/**
 * Acquires a client from the pool and sets the read-only session flag on it.
 * Pooled connections are physical TCP sessions reused across pool.connect()
 * calls, so this must run on every acquire — not just once at pool creation —
 * or a later checkout could silently get a session without the flag set.
 */
export async function getReadOnlyClient(pool: Pool): Promise<PoolClient> {
  const client = await pool.connect();
  await client.query("SET default_transaction_read_only = on");
  return client;
}

/**
 * Opens a pooled connection to a user-supplied Postgres database, enforces the
 * read-only session flag, and validates it responds to a trivial query.
 * Returns the live Pool on success — caller is responsible for pool.end() when done.
 */
export async function connectAndValidate(connectionString: string): Promise<Result<Pool>> {
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: MAX_POOL_CLIENTS,
  });
  // Never let a pool-level error crash the process — surface failures through query() rejections instead.
  pool.on("error", () => {});

  let client: PoolClient;
  try {
    client = await getReadOnlyClient(pool);
  } catch (err) {
    await pool.end().catch(() => {});
    return { ok: false, reason: classifyConnectionError(err), detail: (err as Error).message };
  }

  try {
    await client.query("SELECT 1");
  } catch (err) {
    client.release();
    await pool.end().catch(() => {});
    return { ok: false, reason: classifyConnectionError(err), detail: (err as Error).message };
  }

  client.release();
  return { ok: true, value: pool };
}
