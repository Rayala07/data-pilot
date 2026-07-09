// Orchestrates the connect → validate → encrypt → introspect → persist flow.
// Talks to the userdb pool and the (framework-free) engine, but never to
// Express or Prisma directly — Prisma access goes through the repository.

import type { Connection } from "@prisma/client";
import type { Pool } from "pg";
import { executeSelect } from "../../engine/execute";
import { introspectSchema } from "../../engine/introspect";
import {
  buildDateRangeSql,
  fallbackSummary,
  generateSummary,
  pickDateRangeTarget,
} from "../../engine/present/summary";
import { getEmbeddingProvider, getLLMProvider } from "../../engine/providers/openaiCompatible";
import { enrichSchemaProfile, retrieveTables } from "../../engine/retrieval";
import type {
  ConnectionSummary,
  Result,
  RetrievedTable,
  SchemaProfile,
  TableProfile,
} from "../../engine/types";
import { decrypt, encrypt } from "../../shared/crypto";
import { connectAndValidate } from "../../userdb/pool";
import { probeWriteAccess } from "../../userdb/privileges";
import * as repo from "./connections.repository";
import type { CreateConnectionInput, CreateConnectionResult } from "./connections.types";

// Introspects on an already-validated pool, enriches for retrieval, and
// persists the result. Always closes the pool — Day 1/2 scan once at
// connect/rescan time; no long-lived pool is kept between requests yet.
async function introspectAndPersist(pool: Pool, connectionId: string): Promise<Result<SchemaProfile>> {
  try {
    // Verify hard rule 1 rather than merely asking for it: does this credential
    // actually lack write access? Informational, and never fatal — a probe that
    // can't answer records null and the UI simply says nothing.
    await repo.setCredentialWriteAccess(connectionId, await probeWriteAccess(pool));

    const introspectResult = await introspectSchema(pool, connectionId);
    if (!introspectResult.ok) return introspectResult;

    const profile = introspectResult.value;

    // Enrich with LLM descriptions + embeddings for retrieval (Day 2). Non-fatal:
    // if the provider is misconfigured or fails, we still persist the introspected
    // profile so the schema view works — retrieval just has no vectors until a
    // successful rescan.
    try {
      await enrichSchemaProfile(profile, getLLMProvider(), getEmbeddingProvider());
    } catch {
      // swallow — enrichment is best-effort at ingest
    }

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

/**
 * Business-language summary of a connection.
 *
 * Cache-first: generated once (an LLM call) and served from the SchemaProfile
 * row afterwards. `saveSchemaProfile` nulls it on rescan, so a changed schema
 * regenerates. The user's database is never rescanned here — at most ONE cheap
 * MIN/MAX query runs, through the same read-only/timeout/row-cap path as every
 * other user-DB read.
 *
 * Never fails: an LLM outage degrades to the deterministic fallback rather than
 * breaking the first screen a user sees after connecting.
 */
export async function getConnectionSummary(
  connection: Connection
): Promise<Result<ConnectionSummary, "not_scanned">> {
  const stored = await repo.getSchemaProfile(connection.id);
  if (!stored) {
    return { ok: false, reason: "not_scanned", detail: "This connection hasn't been scanned yet." };
  }

  // Cache hit — no LLM call, no user-DB query.
  if (stored.summary) {
    return { ok: true, value: stored.summary as unknown as ConnectionSummary };
  }

  const profile: SchemaProfile = {
    connectionId: connection.id,
    scannedAt: stored.scannedAt.toISOString(),
    tables: stored.tables as unknown as TableProfile[],
  };

  let summary: ConnectionSummary;
  try {
    const generated = await generateSummary(profile, getLLMProvider());
    summary = generated.ok ? generated.value : fallbackSummary(profile);
  } catch {
    // Provider misconfigured (e.g. missing key) — construction throws.
    summary = fallbackSummary(profile);
  }

  summary.dateRange = await readDateRange(connection, profile);

  await repo.saveSummary(connection.id, summary as unknown as object);
  return { ok: true, value: summary };
}

/**
 * At most one query against the user's database. Any failure yields null and
 * the UI omits the line — we don't build scanning infrastructure for a caption.
 */
async function readDateRange(
  connection: Connection,
  profile: SchemaProfile
): Promise<ConnectionSummary["dateRange"]> {
  const target = pickDateRangeTarget(profile);
  if (!target) return null;

  const connectionString = decrypt({
    cipherText: connection.connectionStringCipher,
    iv: connection.connectionStringIv,
    tag: connection.connectionStringTag,
  });

  const opened = await connectAndValidate(connectionString);
  if (!opened.ok) return null;

  try {
    const result = await executeSelect(opened.value, buildDateRangeSql(target));
    if (!result.ok || result.rows.length === 0) return null;

    const row = result.rows[0];
    const from = toIsoDate(row.from_date);
    const to = toIsoDate(row.to_date);
    return from && to ? { from, to } : null;
  } catch {
    return null;
  } finally {
    await opened.value.end().catch(() => {});
  }
}

function toIsoDate(value: unknown): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

// Day 2 debug: which tables does retrieval pick for a question, and with what
// scores. Reads the stored (already-embedded) profile — no user-DB access.
export async function retrieveForQuestion(
  connectionId: string,
  question: string
): Promise<Result<RetrievedTable[], "embedding_error" | "not_scanned">> {
  const stored = await repo.getSchemaProfile(connectionId);
  if (!stored) return { ok: false, reason: "not_scanned", detail: "This connection has not been scanned yet" };

  const profile: SchemaProfile = {
    connectionId,
    scannedAt: stored.scannedAt.toISOString(),
    tables: stored.tables as unknown as TableProfile[],
  };
  return retrieveTables(question, profile, getEmbeddingProvider());
}
