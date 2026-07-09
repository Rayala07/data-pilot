// Mirrors the shapes returned by the backend API. Duplicated intentionally —
// the frontend never imports backend code (see CLAUDE.md repo layout rule).

export interface ConnectionListItem {
  id: string;
  name: string;
  tableCount: number;
  scannedAt: string | null;
  /** true = credential can modify data; false = verified read-only; null = not probed. */
  canWrite: boolean | null;
}

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
  description: string;
}

export interface SchemaProfile {
  connectionId: string;
  scannedAt: string;
  tables: TableProfile[];
}

export interface RetrievedTable {
  schema: string;
  name: string;
  score: number;
  viaForeignKey: boolean;
}

// --- Query / presentation (Day 5) -------------------------------------------

export type FieldKind = "numeric" | "date" | "boolean" | "text";

export interface FieldMeta {
  name: string;
  kind: FieldKind;
}

export type ChartSpec =
  | { type: "stat"; label: string; value: string }
  | { type: "line"; xField: string; yFields: string[] }
  | { type: "bar"; xField: string; yField: string }
  | { type: "scatter"; xField: string; yField: string }
  | { type: "table" };

export interface Attempt {
  attemptNumber: number;
  sql: string | null;
  retrievedTables: string[];
  failureType?: string;
  errorText?: string;
  latencyMs: number;
}

export interface QueryAnswer {
  explanation: string;
  sqlDescription: string;
  chart: ChartSpec;
  rows: Record<string, unknown>[];
  fields: FieldMeta[];
  rowCount: number;
  sql: string;
}

export type QueryResponse =
  | { ok: true; answer: QueryAnswer; attempts: Attempt[] }
  | { ok: false; failureType: string; detail: string; sql?: string; attempts: Attempt[] };

export interface UserProfile {
  id: string;
  email: string;
  createdAt: string;
  connectionCount: number;
  queryCount: number;
}

// --- Business summary (post-connect overview) -------------------------------

export interface EntitySummary {
  label: string;
  count: number;
  emoji: string;
}

export interface ConnectionSummary {
  headline: string;
  entities: EntitySummary[];
  dateRange: { from: string; to: string } | null;
  suggestedQuestions: string[];
}
