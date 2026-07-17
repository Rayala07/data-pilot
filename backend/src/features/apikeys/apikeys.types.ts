// Public shapes for API-key management. The raw key is present only in the
// creation response and is never persisted or returned again.

export interface CreatedApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  /** The full secret - shown exactly once, at creation. */
  key: string;
}

export interface ApiKeySummary {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}
