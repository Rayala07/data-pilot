import type { ValidationResult } from "../../shared/validation";
import type { AskInput } from "./query.types";

// The engine's own ceiling (engine/loop MAX_ATTEMPTS). Requests may lower the
// cap but never raise it: attempts cost LLM calls, so an unbounded value from a
// request body would be a way to burn credits.
const ATTEMPT_CEILING = 3;

export function validateAsk(body: unknown): ValidationResult<AskInput> {
  const { connectionId, question, explain, maxAttempts } = (body ?? {}) as Record<string, unknown>;
  if (typeof connectionId !== "string" || !connectionId) {
    return { ok: false, error: "connectionId is required" };
  }
  if (typeof question !== "string" || !question.trim()) {
    return { ok: false, error: "question is required" };
  }
  if (explain !== undefined && typeof explain !== "boolean") {
    return { ok: false, error: "explain must be a boolean" };
  }
  if (maxAttempts !== undefined && (!Number.isInteger(maxAttempts) || (maxAttempts as number) < 1)) {
    return { ok: false, error: "maxAttempts must be a positive integer" };
  }

  // Explanations are on by default; the benchmark opts out.
  return {
    ok: true,
    value: {
      connectionId,
      question: question.trim(),
      explain: explain ?? true,
      maxAttempts:
        maxAttempts === undefined ? undefined : Math.min(maxAttempts as number, ATTEMPT_CEILING),
    },
  };
}
