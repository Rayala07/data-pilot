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

// --- Provider interfaces (Day 2) -------------------------------------------
// The engine depends only on these interfaces, never on a concrete SDK or a
// provider name — implementations live in engine/providers/ and are wired from
// env. This is what makes swapping models a config change (decision D10).

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMProvider {
  complete(
    messages: LLMMessage[],
    opts?: { maxTokens?: number; temperature?: number }
  ): Promise<Result<string, "llm_error">>;
}

export interface EmbeddingProvider {
  /** Embeds a batch of texts, returning one vector per input in order. */
  embed(texts: string[]): Promise<Result<number[][], "embedding_error">>;
}

// --- Retrieval types (Day 2) -----------------------------------------------

export interface RetrievedTable {
  schema: string;
  name: string;
  score: number;
  /** True when pulled in by FK-neighbor expansion rather than direct similarity. */
  viaForeignKey: boolean;
}

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
