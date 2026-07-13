import type { ValidationResult } from "../../shared/validation";

const MAX_NAME_LENGTH = 80;

export function validateKeyName(body: unknown): ValidationResult<{ name: string }> {
  const { name } = (body ?? {}) as Record<string, unknown>;
  if (typeof name !== "string" || !name.trim()) {
    return { ok: false, error: "name is required" };
  }
  if (name.trim().length > MAX_NAME_LENGTH) {
    return { ok: false, error: `name must be ${MAX_NAME_LENGTH} characters or fewer` };
  }
  return { ok: true, value: { name: name.trim() } };
}
