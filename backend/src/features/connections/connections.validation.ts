import type { ValidationResult } from "../../shared/validation";
import type { CreateConnectionInput } from "./connections.types";

export function validateCreateConnection(body: unknown): ValidationResult<CreateConnectionInput> {
  const { name, connectionString } = (body ?? {}) as Record<string, unknown>;
  if (typeof name !== "string" || typeof connectionString !== "string" || !name || !connectionString) {
    return { ok: false, error: "name and connectionString are required" };
  }
  return { ok: true, value: { name, connectionString } };
}

export function validateQuestion(body: unknown): ValidationResult<{ question: string }> {
  const { question } = (body ?? {}) as Record<string, unknown>;
  if (typeof question !== "string" || !question.trim()) {
    return { ok: false, error: "question is required" };
  }
  return { ok: true, value: { question: question.trim() } };
}
