import type { ValidationResult } from "../../shared/validation";
import type { CredentialsInput } from "./auth.types";

export function validateCredentials(body: unknown): ValidationResult<CredentialsInput> {
  const { email, password } = (body ?? {}) as Record<string, unknown>;
  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return { ok: false, error: "email and password are required" };
  }
  return { ok: true, value: { email, password } };
}
