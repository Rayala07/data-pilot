// API-key generation and hashing.
//
// The raw key is `dp_live_` + 32 cryptographically random bytes (base64url).
// We store only its SHA-256 hash and a short non-secret prefix. SHA-256 (not
// bcrypt) is deliberate: an API key is already high-entropy random, so there is
// no dictionary to defend against - the property we need is a fast, exact,
// indexable lookup on every request, which a salted hash cannot give.

import { createHash, randomBytes } from "node:crypto";
import * as repo from "./apikeys.repository";
import type { ApiKeySummary, CreatedApiKey } from "./apikeys.types";

const KEY_PREFIX = "dp_live_";
const RANDOM_BYTES = 32;
/** How much of the key we keep in plaintext for display (prefix + a few chars). */
const DISPLAY_PREFIX_LENGTH = KEY_PREFIX.length + 6;

export function hashKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

function toSummary(k: {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: Date | null;
  createdAt: Date;
  revokedAt: Date | null;
}): ApiKeySummary {
  return {
    id: k.id,
    name: k.name,
    keyPrefix: k.keyPrefix,
    lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
    createdAt: k.createdAt.toISOString(),
    revokedAt: k.revokedAt?.toISOString() ?? null,
  };
}

export async function createKey(userId: string, name: string): Promise<CreatedApiKey> {
  const rawKey = `${KEY_PREFIX}${randomBytes(RANDOM_BYTES).toString("base64url")}`;
  const keyPrefix = rawKey.slice(0, DISPLAY_PREFIX_LENGTH);

  const created = await repo.createApiKey(userId, name, hashKey(rawKey), keyPrefix);

  return {
    id: created.id,
    name: created.name,
    keyPrefix: created.keyPrefix,
    createdAt: created.createdAt.toISOString(),
    // The only time the raw key ever leaves this process.
    key: rawKey,
  };
}

export async function listKeys(userId: string): Promise<ApiKeySummary[]> {
  return (await repo.listApiKeys(userId)).map(toSummary);
}

/** Returns false when nothing was revoked (unknown id, not owned, or already revoked). */
export async function revokeKey(userId: string, id: string): Promise<boolean> {
  return (await repo.revokeApiKey(userId, id)) > 0;
}

/** Permanently removes a revoked key. See repository for the revoke-first rule. */
export function deleteKey(userId: string, id: string): Promise<"deleted" | "not_found" | "not_revoked"> {
  return repo.deleteRevokedApiKey(userId, id);
}
