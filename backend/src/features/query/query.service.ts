// Drives the self-correction loop for one question: retrieve the relevant
// tables, then hand generate/validate/execute to engine/loop, which retries
// with structured feedback up to 3 times. This layer owns everything the
// engine must not touch: the pg pool lifecycle and the QueryLog writes.

import type { Connection } from "@prisma/client";
import type { Pool } from "pg";
import { executeSelect, type ExecuteOutcome } from "../../engine/execute";
import { runLoop } from "../../engine/loop";
import { present } from "../../engine/present";
import { getEmbeddingProvider, getLLMProvider } from "../../engine/providers/openaiCompatible";
import { retrieveTables } from "../../engine/retrieval";
import type { SchemaProfile, TableProfile } from "../../engine/types";
import { decrypt } from "../../shared/crypto";
import { connectAndValidate } from "../../userdb/pool";
import { getSchemaProfile } from "../connections/connections.repository";
import { writeQueryLog } from "./query.repository";
import type { QueryOutcome } from "./query.types";

/**
 * Dev-only hook for demonstrating the self-correction loop: corrupts one
 * column's name in the PROMPT only. Validation still runs against the real
 * schema, so attempt 1 hallucinates and the feedback hands the model the real
 * column list - exactly the recovery path we want to show. Never set in prod.
 *
 *   DEV_POISON_COLUMN="usr.full_nm"                -> renames to full_nm_x
 *   DEV_POISON_COLUMN="usr.full_nm:customer_name"  -> renames to customer_name
 *
 * Prefer an explicit, plausible-looking replacement: given an obviously mangled
 * name the model tends to "helpfully" correct it back and never misses.
 */
function applyPoison(tables: TableProfile[]): TableProfile[] {
  const spec = process.env.DEV_POISON_COLUMN;
  if (!spec) return tables;

  const [target, replacement] = spec.split(":");
  const [table, column] = (target ?? "").split(".");
  if (!table || !column) return tables;
  const poisoned = replacement || `${column}_x`;

  return tables.map((t) =>
    t.name !== table
      ? t
      : { ...t, columns: t.columns.map((c) => (c.name === column ? { ...c, name: poisoned } : c)) }
  );
}

export async function runQuery(
  userId: string,
  connection: Connection,
  question: string,
  opts: { explain?: boolean; maxAttempts?: number } = {}
): Promise<QueryOutcome> {
  const stored = await getSchemaProfile(connection.id);
  if (!stored) {
    return { ok: false, failureType: "not_scanned", detail: "This connection hasn't been scanned yet.", attempts: [] };
  }
  const profile: SchemaProfile = {
    connectionId: connection.id,
    scannedAt: stored.scannedAt.toISOString(),
    tables: stored.tables as unknown as TableProfile[],
  };

  // --- retrieve (Day 2) ---
  const retrieval = await retrieveTables(question, profile, getEmbeddingProvider());
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
  const retrievedNames = retrieved.map((t) => t.name);
  const nameSet = new Set(retrievedNames);
  const focusedTables = applyPoison(profile.tables.filter((t) => nameSet.has(t.name)));

  // The pool is opened lazily on the first execute: a question whose SQL never
  // survives validation (e.g. "drop the usr table") should never touch the DB.
  let pool: Pool | null = null;
  const execute = async (sql: string): Promise<ExecuteOutcome> => {
    if (!pool) {
      const connectionString = decrypt({
        cipherText: connection.connectionStringCipher,
        iv: connection.connectionStringIv,
        tag: connection.connectionStringTag,
      });
      const opened = await connectAndValidate(connectionString);
      if (!opened.ok) return { ok: false, detail: `Couldn't open the database: ${opened.detail}` };
      pool = opened.value;
    }
    return executeSelect(pool, sql);
  };

  const llm = getLLMProvider();

  try {
    const result = await runLoop({
      question,
      profile,
      focusedTables,
      retrievedTableNames: retrievedNames,
      llm,
      execute,
      // undefined leaves the engine's default (3) in force.
      maxAttempts: opts.maxAttempts,
      onAttempt: (record) =>
        writeQueryLog({
          userId,
          connectionId: connection.id,
          question,
          retrievedTables: retrieved,
          sql: record.sql,
          validationResult: record.validationResult,
          executionResult: record.executionResult,
          errorText: record.errorText,
          attemptNumber: record.attemptNumber,
          latencyMs: record.latencyMs,
        }).then(() => undefined),
    });

    if (result.ok) {
      // Chart selection is pure and always succeeds; the explanation is
      // best-effort, so a provider hiccup degrades the prose, never the answer.
      const presentation = await present(
        { question, sql: result.sql, fields: result.fields, rows: result.rows },
        llm,
        { explain: opts.explain }
      );
      return {
        ok: true,
        answer: {
          explanation: presentation.explanation,
          sqlDescription: presentation.sqlDescription,
          chart: presentation.chart,
          rows: result.rows,
          fields: result.fields,
          rowCount: result.rowCount,
          sql: result.sql,
        },
        attempts: result.attempts,
      };
    }
    return {
      ok: false,
      failureType: result.failureType,
      detail: result.detail,
      sql: result.sql ?? undefined,
      attempts: result.attempts,
    };
  } finally {
    if (pool) await (pool as Pool).end().catch(() => {});
  }
}
