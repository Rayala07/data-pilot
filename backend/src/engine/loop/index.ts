// The self-correction loop — the centerpiece of the engine — modelled as an
// explicit LangGraph state machine:
//
//        START ──▶ generate ──▶ validate ──▶ execute ──▶ END (success)
//                     │            │            │
//                     │            │ security   │
//                     │            └──▶ END     │
//                     └──────◀── retry ─────────┘
//                          (structured feedback)
//
// Up to 3 attempts (D7). Retries converge because validation runs against the
// real SchemaProfile, so a hallucinated identifier comes back with the actual
// available columns named (D6). A `security` failure is terminal: it routes
// straight to END and the execute node is never entered (D7a).
//
// Framework-free of the app: this module never imports pg, Express, or Prisma.
// Execution is injected as a function and per-attempt persistence is a
// callback, so the caller owns the pool and the database writes.

import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { generateSql, type RetryFeedback } from "../generate";
import type { ExecuteOutcome } from "../execute";
import type { AttemptFailureType, FieldMeta, LLMProvider, QueryAttempt, SchemaProfile, TableProfile } from "../types";
import { validateSql } from "../validate";

const MAX_ATTEMPTS = 3;
const NODES_PER_ATTEMPT = 3;

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
      fields: FieldMeta[];
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

interface Failure {
  failureType: AttemptFailureType;
  detail: string;
}
interface Success {
  sql: string;
  rows: Record<string, unknown>[];
  fields: FieldMeta[];
  rowCount: number;
}

const overwrite = <T,>(_prev: T, next: T): T => next;

// Channels carry only what flows between nodes. The providers and callbacks
// stay in closures rather than in state — they aren't data, and state that
// can't be inspected or serialized is state you can't debug.
const LoopState = Annotation.Root({
  attemptNumber: Annotation<number>({ reducer: overwrite, default: () => 0 }),
  /** Set when an attempt begins, so any node can compute that attempt's latency. */
  startedAt: Annotation<number>({ reducer: overwrite, default: () => 0 }),
  sql: Annotation<string | null>({ reducer: overwrite, default: () => null }),
  feedback: Annotation<RetryFeedback | undefined>({ reducer: overwrite, default: () => undefined }),
  failure: Annotation<Failure | null>({ reducer: overwrite, default: () => null }),
  success: Annotation<Success | null>({ reducer: overwrite, default: () => null }),
  /** The only accumulating channel: each node appends the attempt it just finished. */
  attempts: Annotation<QueryAttempt[]>({
    reducer: (prev, next) => (prev ?? []).concat(next ?? []),
    default: () => [],
  }),
});

type LoopStateType = typeof LoopState.State;

export async function runLoop(opts: LoopOptions): Promise<LoopOutcome> {
  const maxAttempts = opts.maxAttempts ?? MAX_ATTEMPTS;

  // Persists the attempt and returns the public shape the API exposes.
  const record = async (
    r: Omit<LoopAttemptRecord, "latencyMs">,
    startedAt: number
  ): Promise<QueryAttempt> => {
    const latencyMs = Date.now() - startedAt;
    await opts.onAttempt?.({ ...r, latencyMs });
    return {
      attemptNumber: r.attemptNumber,
      sql: r.sql,
      retrievedTables: opts.retrievedTableNames,
      failureType: r.failureType,
      errorText: r.errorText ?? undefined,
      latencyMs,
    };
  };

  // --- nodes ---------------------------------------------------------------

  async function generateNode(state: LoopStateType): Promise<Partial<LoopStateType>> {
    const attemptNumber = state.attemptNumber + 1;
    const startedAt = Date.now();

    const gen = await generateSql(opts.question, opts.focusedTables, opts.llm, state.feedback);
    if (!gen.ok) {
      // Prose instead of SQL, an empty completion, or a provider error. Treat as
      // a validation-class failure and tell the model exactly what we needed.
      const detail = gen.detail;
      const attempt = await record(
        {
          attemptNumber,
          sql: null,
          failureType: "validation",
          errorText: detail,
          validationResult: { ok: false, failureType: "validation", detail },
          executionResult: null,
        },
        startedAt
      );
      return {
        attemptNumber,
        startedAt,
        sql: null,
        failure: { failureType: "validation", detail },
        feedback: { previousSql: "(no SQL was produced)", failureType: "validation", detail },
        attempts: [attempt],
      };
    }

    return { attemptNumber, startedAt, sql: gen.value, failure: null };
  }

  async function validateNode(state: LoopStateType): Promise<Partial<LoopStateType>> {
    const sql = state.sql as string;
    const validation = validateSql(sql, opts.profile);
    if (validation.ok) return { failure: null };

    const attempt = await record(
      {
        attemptNumber: state.attemptNumber,
        sql,
        failureType: validation.failureType,
        errorText: validation.detail,
        validationResult: { ok: false, failureType: validation.failureType, detail: validation.detail },
        executionResult: null,
      },
      state.startedAt
    );
    return {
      failure: { failureType: validation.failureType, detail: validation.detail },
      feedback: { previousSql: sql, failureType: validation.failureType, detail: validation.detail },
      attempts: [attempt],
    };
  }

  async function executeNode(state: LoopStateType): Promise<Partial<LoopStateType>> {
    const sql = state.sql as string;
    const exec = await opts.execute(sql);

    if (!exec.ok) {
      const attempt = await record(
        {
          attemptNumber: state.attemptNumber,
          sql,
          failureType: "execution",
          errorText: exec.detail,
          validationResult: { ok: true },
          executionResult: { ok: false, detail: exec.detail },
        },
        state.startedAt
      );
      return {
        failure: { failureType: "execution", detail: exec.detail },
        feedback: { previousSql: sql, failureType: "execution", detail: exec.detail },
        attempts: [attempt],
      };
    }

    // An empty result set is a valid answer, not a failure — never retried.
    const attempt = await record(
      {
        attemptNumber: state.attemptNumber,
        sql,
        errorText: null,
        validationResult: { ok: true },
        executionResult: { ok: true, rowCount: exec.rowCount, fields: exec.fields },
      },
      state.startedAt
    );
    return {
      failure: null,
      success: { sql, rows: exec.rows, fields: exec.fields, rowCount: exec.rowCount },
      attempts: [attempt],
    };
  }

  // --- edges ---------------------------------------------------------------

  // Bounded retries (D7): the attempt counter, not the graph, decides when to stop.
  const retryOrEnd = (state: LoopStateType) => (state.attemptNumber < maxAttempts ? "generate" : END);

  const afterGenerate = (state: LoopStateType) => (state.failure ? retryOrEnd(state) : "validate");

  const afterValidate = (state: LoopStateType) => {
    if (!state.failure) return "execute";
    // A security violation is a request to DENY, not a mistake to converge on.
    // Routing to END here is what guarantees `execute` is never entered (D7a).
    if (state.failure.failureType === "security") return END;
    return retryOrEnd(state);
  };

  const afterExecute = (state: LoopStateType) => (state.success ? END : retryOrEnd(state));

  const graph = new StateGraph(LoopState)
    .addNode("generate", generateNode)
    .addNode("validate", validateNode)
    .addNode("execute", executeNode)
    .addEdge(START, "generate")
    .addConditionalEdges("generate", afterGenerate, { validate: "validate", generate: "generate", [END]: END })
    .addConditionalEdges("validate", afterValidate, { execute: "execute", generate: "generate", [END]: END })
    .addConditionalEdges("execute", afterExecute, { generate: "generate", [END]: END })
    .compile();

  // retryOrEnd already caps the walk; this is a backstop against an edge-routing
  // bug turning into an unbounded (and billable) loop.
  const final = await graph.invoke(
    {},
    { recursionLimit: maxAttempts * NODES_PER_ATTEMPT + 2 }
  );

  if (final.success) {
    const { sql, rows, fields, rowCount } = final.success;
    return { ok: true, sql, rows, fields, rowCount, attempts: final.attempts };
  }

  // Attempts exhausted (or denied) — report the last failure honestly rather
  // than faking an answer.
  return {
    ok: false,
    failureType: final.failure?.failureType ?? "validation",
    detail: final.failure?.detail ?? "Query could not be generated.",
    sql: final.sql,
    attempts: final.attempts,
  };
}
