import type { ValidationResult } from "../../shared/validation";
import type { AskInput } from "./query.types";

export function validateAsk(body: unknown): ValidationResult<AskInput> {
  const { connectionId, question } = (body ?? {}) as Record<string, unknown>;
  if (typeof connectionId !== "string" || !connectionId) {
    return { ok: false, error: "connectionId is required" };
  }
  if (typeof question !== "string" || !question.trim()) {
    return { ok: false, error: "question is required" };
  }
  return { ok: true, value: { connectionId, question: question.trim() } };
}
