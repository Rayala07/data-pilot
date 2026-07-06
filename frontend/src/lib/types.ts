// Mirrors the shapes returned by the backend API. Duplicated intentionally —
// the frontend never imports backend code (see CLAUDE.md repo layout rule).

export interface ConnectionSummary {
  id: string;
  name: string;
  tableCount: number;
  scannedAt: string | null;
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
