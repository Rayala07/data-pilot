import bcrypt from "bcrypt";
import { signToken } from "./auth.jwt";
import { createUser, findUserByEmail } from "./auth.repository";
import type { AuthResult, CredentialsInput } from "./auth.types";

const BCRYPT_COST = 12;

export async function signup({ email, password }: CredentialsInput): Promise<AuthResult> {
  const existing = await findUserByEmail(email);
  if (existing) {
    return { ok: false, status: 409, error: "An account with that email already exists" };
  }
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  const user = await createUser(email, passwordHash);
  return { ok: true, token: signToken({ userId: user.id }) };
}

export async function login({ email, password }: CredentialsInput): Promise<AuthResult> {
  const user = await findUserByEmail(email);
  // Always run through the same failure branch on either a missing user or a
  // bad password so the response doesn't reveal which one it was.
  const valid = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || !valid) {
    return { ok: false, status: 401, error: "Invalid email or password" };
  }
  return { ok: true, token: signToken({ userId: user.id }) };
}
