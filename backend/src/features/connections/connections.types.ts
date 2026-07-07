import type { FailureReason } from "../../engine/types";

export interface CreateConnectionInput {
  name: string;
  connectionString: string;
}

export interface ConnectionSummary {
  id: string;
  name: string;
  tableCount: number;
  scannedAt: Date | null;
}

// On scan failure the Connection row already exists, so the id is carried back
// so the client can offer a rescan without re-entering the string.
export type CreateConnectionResult =
  | { ok: true; connection: { id: string; name: string; tableCount: number } }
  | { ok: false; reason: FailureReason; connectionId?: string };
