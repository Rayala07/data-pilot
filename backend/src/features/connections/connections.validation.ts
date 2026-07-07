import type { ValidationResult } from "../../shared/validation";
import type { CreateConnectionInput } from "./connections.types";

export function validateCreateConnection(body: unknown): ValidationResult<CreateConnectionInput> {
  const { name, connectionString } = (body ?? {}) as Record<string, unknown>;
  if (typeof name !== "string" || typeof connectionString !== "string" || !name || !connectionString) {
    return { ok: false, error: "name and connectionString are required" };
  }
  return { ok: true, value: { name, connectionString } };
}
