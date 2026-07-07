// Orchestrates the connect → validate → encrypt → introspect → persist flow.
// Talks to the userdb pool and the (framework-free) engine, but never to
// Express or Prisma directly — Prisma access goes through the repository.

import type { Connection } from "@prisma/client";
import type { Pool } from "pg";
import { introspectSchema } from "../../engine/introspect";
import type { Result, SchemaProfile } from "../../engine/types";
import { decrypt, encrypt } from "../../shared/crypto";
import { connectAndValidate } from "../../userdb/pool";
import * as repo from "./connections.repository";
import type { CreateConnectionInput, CreateConnectionResult } from "./connections.types";

// Introspects on an already-validated pool and persists the result. Always
// closes the pool — Day 1 scans once at connect/rescan time, no long-lived
// pool is kept between requests yet.
async function introspectAndPersist(pool: Pool, connectionId: string): Promise<Result<SchemaProfile>> {
  try {
    const introspectResult = await introspectSchema(pool, connectionId);
    if (!introspectResult.ok) return introspectResult;

    const profile = introspectResult.value;
    await repo.saveSchemaProfile(connectionId, profile.scannedAt, profile.tables as object);
    return introspectResult;
  } finally {
    await pool.end().catch(() => {});
  }
}

export async function createAndScan(userId: string, input: CreateConnectionInput): Promise<CreateConnectionResult> {
  const validation = await connectAndValidate(input.connectionString);
  if (!validation.ok) return { ok: false, reason: validation.reason };

  const enc = encrypt(input.connectionString);
  const connection = await repo.createConnection(userId, input.name, enc);

  const scan = await introspectAndPersist(validation.value, connection.id);
  if (!scan.ok) return { ok: false, reason: scan.reason, connectionId: connection.id };

  return { ok: true, connection: { id: connection.id, name: connection.name, tableCount: scan.value.tables.length } };
}

export async function rescan(connection: Connection): Promise<Result<SchemaProfile>> {
  const connectionString = decrypt({
    cipherText: connection.connectionStringCipher,
    iv: connection.connectionStringIv,
    tag: connection.connectionStringTag,
  });

  const validation = await connectAndValidate(connectionString);
  if (!validation.ok) return validation;

  return introspectAndPersist(validation.value, connection.id);
}
