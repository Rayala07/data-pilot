// All app-DB access for API keys. Like every repository here, list/revoke are
// userId-scoped so one tenant can never touch another's keys.

import type { ApiKey } from "@prisma/client";
import { prisma } from "../../db/prisma";

export function createApiKey(userId: string, name: string, keyHash: string, keyPrefix: string): Promise<ApiKey> {
  return prisma.apiKey.create({ data: { userId, name, keyHash, keyPrefix } });
}

export function listApiKeys(userId: string): Promise<ApiKey[]> {
  return prisma.apiKey.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
}

/** Scoped by userId; returns the affected count so the route can 404 on a miss. */
export async function revokeApiKey(userId: string, id: string): Promise<number> {
  const result = await prisma.apiKey.updateMany({
    where: { id, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count;
}

/**
 * The authentication lookup: an ACTIVE key by its hash. Returns only what the
 * middleware needs (the owning userId + the key id), never a raw secret.
 */
export function findActiveKeyByHash(keyHash: string): Promise<{ id: string; userId: string } | null> {
  return prisma.apiKey.findFirst({
    where: { keyHash, revokedAt: null },
    select: { id: true, userId: true },
  });
}

/** Fire-and-forget from the middleware; must never throw into the request path. */
export function touchLastUsed(id: string): Promise<unknown> {
  return prisma.apiKey.update({ where: { id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
}
