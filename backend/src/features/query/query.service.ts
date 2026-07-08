// Orchestrates a single query pass: retrieve -> generate -> validate ->
// execute, logging the attempt to QueryLog no matter where it ends. Day 3 runs
// exactly one attempt; Day 4's loop/ will wrap this pipeline to retry with
// structured failure feedback, which is why each stage returns a typed result
// rather than throwing.

import type { Connection } from "@prisma/client";
import { executeSelect } from "../../engine/execute";
import { generateSql } from "../../engine/generate";
import { getEmbeddingProvider, getLLMProvider } from "../../engine/providers/openaiCompatible";
import { retrieveTables } from "../../engine/retrieval";
import type { AttemptFailureType, QueryAttempt, RetrievedTable, SchemaProfile, TableProfile } from "../../engine/types";
import { validateSql } from "../../engine/validate";
import { decrypt } from "../../shared/crypto";
import { connectAndValidate } from "../../userdb/pool";
import { getSchemaProfile } from "../connections/connections.repository";
import { writeQueryLog } from "./query.repository";
import type { QueryOutcome } from "./query.types";

interface RecordArgs {
  userId: string;
  connectionId: string;
  question: string;
  retrieved: RetrievedTable[];
  sql: string | null;
  failureType?: AttemptFailureType;
  errorText: string | null;
  validationResult: unknown;
  executionResult: unknown;
  latencyMs: number;
  attemptNumber: number;
}

// Writes the QueryLog row and returns the QueryAttempt shape the API exposes.
async function record(args: RecordArgs): Promise<QueryAttempt> {
  await writeQueryLog({
    userId: args.userId,
    connectionId: args.connectionId,
    question: args.question,
    retrievedTables: args.retrieved,
    sql: args.sql,
    validationResult: args.validationResult,
    executionResult: args.executionResult,
    errorText: args.errorText,
    attemptNumber: args.attemptNumber,
    latencyMs: args.latencyMs,
  });
  return {
    attemptNumber: args.attemptNumber,
    sql: args.sql,
    retrievedTables: args.retrieved.map((t) => t.name),
    failureType: args.failureType,
    errorText: args.errorText ?? undefined,
    latencyMs: args.latencyMs,
  };
}

export async function runQuery(userId: string, connection: Connection, question: string): Promise<QueryOutcome> {
  const stored = await getSchemaProfile(connection.id);
  if (!stored) {
    return { ok: false, failureType: "not_scanned", detail: "This connection hasn't been scanned yet.", attempts: [] };
  }
  const profile: SchemaProfile = {
    connectionId: connection.id,
    scannedAt: stored.scannedAt.toISOString(),
    tables: stored.tables as unknown as TableProfile[],
  };

  const embedder = getEmbeddingProvider();
  const llm = getLLMProvider();
  const attemptNumber = 1;
  const started = Date.now();

  // --- retrieve ---
  const retrieval = await retrieveTables(question, profile, embedder);
  if (!retrieval.ok) {
    return { ok: false, failureType: "retrieval", detail: `Retrieval failed: ${retrieval.detail}`, attempts: [] };
  }
  const retrieved = retrieval.value;
  if (retrieved.length === 0) {
    return {
      ok: false,
      failureType: "retrieval",
      detail: "I couldn't find tables related to that question in this database.",
      attempts: [],
    };
  }
  const retrievedNames = new Set(retrieved.map((t) => t.name));
  const focused = profile.tables.filter((t) => retrievedNames.has(t.name));

  // --- generate ---
  const gen = await generateSql(question, focused, llm);
  if (!gen.ok) {
    const latencyMs = Date.now() - started;
    const attempt = await record({
      userId, connectionId: connection.id, question, retrieved, sql: null,
      errorText: gen.detail, validationResult: null, executionResult: null, latencyMs, attemptNumber,
    });
    return { ok: false, failureType: "generation", detail: gen.detail, attempts: [attempt] };
  }
  const sql = gen.value;

  // --- validate (before execution, per D6) ---
  const validation = validateSql(sql, profile);
  if (!validation.ok) {
    const latencyMs = Date.now() - started;
    const attempt = await record({
      userId, connectionId: connection.id, question, retrieved, sql,
      failureType: validation.failureType, errorText: validation.detail,
      validationResult: { ok: false, failureType: validation.failureType, detail: validation.detail },
      executionResult: null, latencyMs, attemptNumber,
    });
    return { ok: false, failureType: validation.failureType, detail: validation.detail, sql, attempts: [attempt] };
  }

  // --- execute ---
  const connectionString = decrypt({
    cipherText: connection.connectionStringCipher,
    iv: connection.connectionStringIv,
    tag: connection.connectionStringTag,
  });
  const opened = await connectAndValidate(connectionString);
  if (!opened.ok) {
    const latencyMs = Date.now() - started;
    const detail = `Couldn't open the database to run the query: ${opened.detail}`;
    const attempt = await record({
      userId, connectionId: connection.id, question, retrieved, sql, failureType: "execution",
      errorText: detail, validationResult: { ok: true }, executionResult: { ok: false, detail },
      latencyMs, attemptNumber,
    });
    return { ok: false, failureType: "execution", detail, sql, attempts: [attempt] };
  }

  let exec;
  try {
    exec = await executeSelect(opened.value, sql);
  } finally {
    await opened.value.end().catch(() => {});
  }

  const latencyMs = Date.now() - started;
  if (!exec.ok) {
    const attempt = await record({
      userId, connectionId: connection.id, question, retrieved, sql, failureType: "execution",
      errorText: exec.detail, validationResult: { ok: true }, executionResult: { ok: false, detail: exec.detail },
      latencyMs, attemptNumber,
    });
    return { ok: false, failureType: "execution", detail: exec.detail, sql, attempts: [attempt] };
  }

  const attempt = await record({
    userId, connectionId: connection.id, question, retrieved, sql, errorText: null,
    validationResult: { ok: true }, executionResult: { ok: true, rowCount: exec.rowCount, fields: exec.fields },
    latencyMs, attemptNumber,
  });
  return { ok: true, sql, rows: exec.rows, fields: exec.fields, rowCount: exec.rowCount, attempts: [attempt] };
}
