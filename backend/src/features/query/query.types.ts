import type { AttemptFailureType, ChartSpec, FieldMeta, QueryAttempt } from "../../engine/types";

export interface AskInput {
  connectionId: string;
  question: string;
  /** Skip the NL explanation LLM call. The Day 6 benchmark sets this false. */
  explain: boolean;
  /**
   * Cap on generate/validate/execute attempts. Undefined means the engine's
   * default (3). The benchmark sets 1 to measure one-shot accuracy, which is
   * what makes the self-correction loop's contribution measurable rather than
   * asserted. Never raises the ceiling - see validateAsk.
   */
  maxAttempts?: number;
}

// Failure surfaces the query can report. The AST failure types plus the
// pipeline stages that can fail before/around validation.
export type QueryFailureType = AttemptFailureType | "generation" | "retrieval" | "not_scanned";

/** The rendered answer, per the API contract in architecture.md. */
export interface QueryAnswer {
  explanation: string;
  sqlDescription: string;
  chart: ChartSpec;
  rows: Record<string, unknown>[];
  fields: FieldMeta[];
  rowCount: number;
  sql: string;
}

export type QueryOutcome =
  | { ok: true; answer: QueryAnswer; attempts: QueryAttempt[] }
  | {
      ok: false;
      failureType: QueryFailureType;
      detail: string;
      sql?: string;
      attempts: QueryAttempt[];
    };
