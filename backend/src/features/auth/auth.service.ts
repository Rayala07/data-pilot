// bcryptjs, not bcrypt: the native addon was the only package in the whole
// backend needing a C++ toolchain (python3/make/g++) to install. The pure-JS
// implementation produces and verifies the same $2b$ hashes — existing
// passwords keep working — and costs ~40ms more per hash, on login only.
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import {
  cloneConnectionForUser,
  countConnections,
  getConnectionByIdInternal,
} from "../connections/connections.repository";
import { getConnectionSummary } from "../connections/connections.service";
import { countQueryLogs } from "../query/query.repository";
import { signToken } from "./auth.jwt";
import {
  countDemoUsers,
  createDemoUser,
  createUser,
  deleteDemoUsersOlderThan,
  findUserByEmail,
  findUserById,
} from "./auth.repository";
import type { AuthResult, CredentialsInput, UserProfile } from "./auth.types";

const BCRYPT_COST = 12;

// Demo sandboxes: short-lived tokens, 24h retention, and a global ceiling so
// IP-rotating abuse can't bloat the table faster than the sweep drains it.
const DEMO_TOKEN_EXPIRY = "2h";
const DEMO_RETENTION_MS = 24 * 60 * 60 * 1000;
const DEMO_MAX_LIVE_USERS = 200;

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

export type DemoResult =
  | { ok: true; token: string; connectionId: string }
  | { ok: false; status: number; error: string };

/**
 * Creates an ephemeral demo tenant: a throwaway user with the template
 * connection CLONED in — row copies only. The embeddings and cached summary
 * come along with the SchemaProfile, so no LLM is called and the sandbox is
 * ready in well under a second. Each visitor is a real, isolated tenant; the
 * same row-level scoping that protects paying users protects them too.
 */
export async function createDemoSession(): Promise<DemoResult> {
  const templateId = process.env.DEMO_TEMPLATE_CONNECTION_ID;
  if (!templateId) {
    return { ok: false, status: 503, error: "Demo mode is not configured" };
  }

  // Resolve the template before creating anything, so a bad configuration
  // never leaves an orphan demo user behind.
  const template = await getConnectionByIdInternal(templateId);
  if (!template) {
    return { ok: false, status: 503, error: "Demo mode is not configured" };
  }

  // Self-healing: a rescan of the template nulls its cached summary (by
  // design), and a clone copies that null — every visitor would then pay the
  // LLM-generation wait on landing. Warming here means at most ONE unlucky
  // request regenerates it; everyone after clones a warm cache.
  await getConnectionSummary(template);

  // Lazy sweep: creation is the only moment demo rows appear, so it's also a
  // sufficient moment to remove expired ones. No cron needed.
  await deleteDemoUsersOlderThan(new Date(Date.now() - DEMO_RETENTION_MS));

  if ((await countDemoUsers()) >= DEMO_MAX_LIVE_USERS) {
    return { ok: false, status: 503, error: "The demo is at capacity right now — try again in a bit" };
  }

  // Nobody ever logs in with this password; it exists to satisfy the schema.
  // Hashed anyway so a leaked hash is still just a hash.
  const passwordHash = await bcrypt.hash(randomUUID(), BCRYPT_COST);
  const user = await createDemoUser(`demo-${randomUUID().slice(0, 8)}@demo.datapilot.local`, passwordHash);

  const connectionId = await cloneConnectionForUser(templateId, user.id);
  if (!connectionId) {
    return { ok: false, status: 503, error: "Demo mode is not configured" };
  }

  return {
    ok: true,
    token: signToken({ userId: user.id, demo: true }, DEMO_TOKEN_EXPIRY),
    connectionId,
  };
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
