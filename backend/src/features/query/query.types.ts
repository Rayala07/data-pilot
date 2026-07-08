import type { AttemptFailureType, QueryAttempt } from "../../engine/types";

export interface AskInput {
  connectionId: string;
  question: string;
}

// Failure surfaces the query can report. The AST failure types plus the
// pipeline stages that can fail before/around validation.
export type QueryFailureType = AttemptFailureType | "generation" | "retrieval" | "not_scanned";

export type QueryOutcome =
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
      failureType: QueryFailureType;
      detail: string;
      sql?: string;
      attempts: QueryAttempt[];
    };
