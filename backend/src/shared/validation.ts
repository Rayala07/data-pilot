// Shared result shape for per-feature request validators. The validation LOGIC
// stays co-located inside each feature (auth.validation.ts, connections.validation.ts);
// only this common result type is shared.

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };
