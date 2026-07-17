// The single error shape for every /v1 response. Keeping construction in one
// place guarantees consistency and makes it impossible to accidentally leak an
// internal message or stack - callers pass a stable code and a safe message.

export type ApiErrorCode =
  | "bad_request"
  | "unauthorized"
  | "not_found"
  | "rate_limited"
  | "query_failed"
  | "connection_failed"
  | "internal";

export interface ApiErrorBody {
  error: { code: ApiErrorCode; message: string };
  /** Optional extras (e.g. retryAfterSeconds on 429, attempts on query_failed). */
  [key: string]: unknown;
}

export function apiError(code: ApiErrorCode, message: string, extra?: Record<string, unknown>): ApiErrorBody {
  return { error: { code, message }, ...extra };
}
