// bcryptjs, not bcrypt: the native addon was the only package in the whole
// backend needing a C++ toolchain (python3/make/g++) to install. The pure-JS
// implementation produces and verifies the same $2b$ hashes — existing
// passwords keep working — and costs ~40ms more per hash, on login only.
import bcrypt from "bcryptjs";
import { countConnections } from "../connections/connections.repository";
import { countQueryLogs } from "../query/query.repository";
import { signToken } from "./auth.jwt";
import { createUser, findUserByEmail, findUserById } from "./auth.repository";
import type { AuthResult, CredentialsInput, UserProfile } from "./auth.types";

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

/**
 * The authenticated user's own profile. `userId` comes from the verified JWT,
 * never from the request body, and every count is scoped to it.
 */
export async function getProfile(userId: string): Promise<UserProfile | null> {
  const user = await findUserById(userId);
  if (!user) return null;

  const [connectionCount, queryCount] = await Promise.all([
    countConnections(userId),
    countQueryLogs(userId),
  ]);

  return {
    id: user.id,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
    connectionCount,
    queryCount,
  };
}
