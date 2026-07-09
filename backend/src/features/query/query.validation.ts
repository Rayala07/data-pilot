import type { ValidationResult } from "../../shared/validation";
import type { AskInput } from "./query.types";

export function validateAsk(body: unknown): ValidationResult<AskInput> {
  const { connectionId, question, explain } = (body ?? {}) as Record<string, unknown>;
  if (typeof connectionId !== "string" || !connectionId) {
    return { ok: false, error: "connectionId is required" };
  }
  if (typeof question !== "string" || !question.trim()) {
    return { ok: false, error: "question is required" };
  }
  if (explain !== undefined && typeof explain !== "boolean") {
    return { ok: false, error: "explain must be a boolean" };
  }
  // Explanations are on by default; the benchmark opts out.
  return { ok: true, value: { connectionId, question: question.trim(), explain: explain ?? true } };
}
