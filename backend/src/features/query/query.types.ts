import type { AttemptFailureType, ChartSpec, FieldMeta, QueryAttempt } from "../../engine/types";

export interface AskInput {
  connectionId: string;
  question: string;
  /** Skip the NL explanation LLM call. The Day 6 benchmark sets this false. */
  explain: boolean;
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
