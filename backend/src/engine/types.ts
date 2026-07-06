// Shared types for all engine/ modules. Engine code is framework-free —
// nothing here may import Express or Prisma.

export interface ColumnProfile {
  name: string;
  dataType: string;
  nullable: boolean;
  sampleValues: string[];
}

export interface ForeignKeyProfile {
  column: string;
  refTable: string;
  refColumn: string;
}

export interface TableProfile {
  schema: string;
  name: string;
  rowEstimate: number;
  columns: ColumnProfile[];
  primaryKey: string[];
  foreignKeys: ForeignKeyProfile[];
  /** LLM-written 1-2 line summary of what the table appears to hold. Filled Day 2. */
  description: string;
  /** Filled by retrieval module, Day 2. */
  embedding?: number[];
}

export interface SchemaProfile {
  connectionId: string;
  scannedAt: string;
  tables: TableProfile[];
}

// --- Result/error discriminated unions -------------------------------------

export type FailureReason = "unreachable" | "bad_credentials" | "not_postgres" | "introspection_error";

export type Result<T, R extends string = FailureReason> = { ok: true; value: T } | { ok: false; reason: R; detail: string };

// --- Query loop types (Day 3+, stubbed now so routes/ can reference them) --

export type AttemptFailureType = "hallucination" | "validation" | "execution" | "security";

export interface QueryAttempt {
  attemptNumber: number;
  sql: string | null;
  retrievedTables: string[];
  failureType?: AttemptFailureType;
  errorText?: string;
  latencyMs: number;
}

export interface QueryResult {
  rows: Record<string, unknown>[];
  fields: string[];
}
