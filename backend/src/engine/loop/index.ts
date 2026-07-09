// The self-correction loop — the centerpiece of the engine.
//
// Runs generate -> validate -> execute, and on any failure feeds a STRUCTURED
// description of what went wrong back into the next generation attempt, up to
// 3 attempts total (decision D7). What makes retries converge instead of flail
// is that validation checks against the real SchemaProfile, so a hallucinated
// identifier comes back with the actual available columns named (D6).
//
// Framework-free by construction: it never imports pg, Express, or Prisma.
// Execution is injected as a function, and per-attempt persistence is an
// optional callback, so the caller owns the pool and the database writes.

import { generateSql, type RetryFeedback } from "../generate";
import type { ExecuteOutcome } from "../execute";
import type { AttemptFailureType, LLMProvider, QueryAttempt, SchemaProfile, TableProfile } from "../types";
import { validateSql } from "../validate";

const MAX_ATTEMPTS = 3;

/** Full detail of one attempt — richer than QueryAttempt, for QueryLog persistence. */
export interface LoopAttemptRecord {
  attemptNumber: number;
  sql: string | null;
  failureType?: AttemptFailureType;
  errorText: string | null;
  validationResult: unknown;
  executionResult: unknown;
  latencyMs: number;
}

export interface LoopOptions {
  question: string;
  /** Full profile — validation checks against this, so feedback names real identifiers. */
  profile: SchemaProfile;
  /** Only the retrieved tables go into the prompt (focused context). */
  focusedTables: TableProfile[];
  retrievedTableNames: string[];
  llm: LLMProvider;
  /** Injected so the loop stays free of pg. The caller owns pool lifecycle. */
  execute: (sql: string) => Promise<ExecuteOutcome>;
  maxAttempts?: number;
  onAttempt?: (record: LoopAttemptRecord) => Promise<void>;
}

export type LoopOutcome =
  | {
      ok: true;
      sql: string;
      rows: Record<string, unknown>[];
      fields: string[];
      rowCount: number;
      attempts: QueryAttempt[];
    }
  | {
      ok: false;
      failureType: AttemptFailureType;
      detail: string;
      sql: string | null;
      attempts: QueryAttempt[];
    };

export async function runLoop(opts: LoopOptions): Promise<LoopOutcome> {
  const maxAttempts = opts.maxAttempts ?? MAX_ATTEMPTS;
  const attempts: QueryAttempt[] = [];

  let feedback: RetryFeedback | undefined;
  let lastSql: string | null = null;
  let lastFailure: { failureType: AttemptFailureType; detail: string } | null = null;

  for (let attemptNumber = 1; attemptNumber <= maxAttempts; attemptNumber++) {
    const started = Date.now();

    // Records the attempt (log + public shape), then hands back control.
    const finish = async (r: Omit<LoopAttemptRecord, "attemptNumber" | "latencyMs">) => {
      const latencyMs = Date.now() - started;
      const record: LoopAttemptRecord = { ...r, attemptNumber, latencyMs };
      await opts.onAttempt?.(record);
      attempts.push({
        attemptNumber,
        sql: r.sql,
        retrievedTables: opts.retrievedTableNames,
        failureType: r.failureType,
        errorText: r.errorText ?? undefined,
        latencyMs,
      });
    };

    // --- generate ---
    const gen = await generateSql(opts.question, opts.focusedTables, opts.llm, feedback);
    if (!gen.ok) {
      // Prose instead of SQL, an empty completion, or a provider error. Treat as
      // a validation-class failure and tell the model exactly what we needed.
      const detail = gen.detail;
      lastSql = null;
      lastFailure = { failureType: "validation", detail };
      await finish({ sql: null, failureType: "validation", errorText: detail, validationResult: { ok: false, failureType: "validation", detail }, executionResult: null });
      feedback = { previousSql: "(no SQL was produced)", failureType: "validation", detail };
      continue;
    }

    const sql = gen.value;
    lastSql = sql;

    // --- validate (before execution, per D6) ---
    const validation = validateSql(sql, opts.profile);
    if (!validation.ok) {
      lastFailure = { failureType: validation.failureType, detail: validation.detail };
      await finish({
        sql,
        failureType: validation.failureType,
        errorText: validation.detail,
        validationResult: { ok: false, failureType: validation.failureType, detail: validation.detail },
        executionResult: null,
      });

      // A security violation is a request to DENY, not a mistake to fix. Retries
      // exist to converge on a correct query (wrong column, bad syntax, runtime
      // error) — not to coax a model that just tried to DROP a table. This is
      // why architecture.md's retry-feedback types are hallucination |
      // validation | execution, with security deliberately absent.
      if (validation.failureType === "security") {
        return { ok: false, failureType: "security", detail: validation.detail, sql, attempts };
      }

      feedback = { previousSql: sql, failureType: validation.failureType, detail: validation.detail };
      continue;
    }

    // --- execute ---
    const exec = await opts.execute(sql);
    if (!exec.ok) {
      lastFailure = { failureType: "execution", detail: exec.detail };
      await finish({
        sql,
        failureType: "execution",
        errorText: exec.detail,
        validationResult: { ok: true },
        executionResult: { ok: false, detail: exec.detail },
      });
      feedback = { previousSql: sql, failureType: "execution", detail: exec.detail };
      continue;
    }

    // Success. An empty result set is a valid answer, not a failure — never retry it.
    await finish({
      sql,
      errorText: null,
      validationResult: { ok: true },
      executionResult: { ok: true, rowCount: exec.rowCount, fields: exec.fields },
    });
    return { ok: true, sql, rows: exec.rows, fields: exec.fields, rowCount: exec.rowCount, attempts };
  }

  // Attempts exhausted — report the last failure honestly rather than faking an answer.
  return {
    ok: false,
    failureType: lastFailure?.failureType ?? "validation",
    detail: lastFailure?.detail ?? "Query could not be generated.",
    sql: lastSql,
    attempts,
  };
}
