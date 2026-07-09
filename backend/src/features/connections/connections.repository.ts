// All app-DB access for the connections feature. getOwnedConnection is the
// single tenancy choke point every route uses — fetching a Connection by id
// alone is a tenancy bug (CLAUDE.md hard rule 6). A miss returns null so the
// caller can respond 404, never 403 (403 would leak that the id exists).

import { Prisma, type Connection } from "@prisma/client";
import { prisma } from "../../db/prisma";
import type { EncryptedPayload } from "../../shared/crypto";

export function getOwnedConnection(userId: string, connectionId: string): Promise<Connection | null> {
  return prisma.connection.findFirst({ where: { id: connectionId, userId } });
}

export function createConnection(userId: string, name: string, enc: EncryptedPayload) {
  return prisma.connection.create({
    data: {
      userId,
      name,
      connectionStringCipher: enc.cipherText,
      connectionStringIv: enc.iv,
      connectionStringTag: enc.tag,
    },
  });
}

export function listConnections(userId: string) {
  return prisma.connection.findMany({
    where: { userId },
    include: { schemaProfile: true },
    orderBy: { createdAt: "desc" },
  });
}

export function getSchemaProfile(connectionId: string) {
  return prisma.schemaProfile.findUnique({ where: { connectionId } });
}

// Re-scans replace the profile wholesale, so upsert rather than append.
export async function saveSchemaProfile(connectionId: string, scannedAt: string, tables: object): Promise<void> {
  await prisma.schemaProfile.upsert({
    where: { connectionId },
    create: { connectionId, scannedAt, tables },
    // A rescan means the schema changed, so the cached summary describes a
    // database that no longer exists. Drop it; the next request regenerates.
    update: { scannedAt, tables, summary: Prisma.DbNull },
  });
  await prisma.connection.update({
    where: { id: connectionId },
    data: { lastScannedAt: scannedAt },
  });
}

/** Caches the generated business summary so later loads cost no LLM call. */
export async function saveSummary(connectionId: string, summary: object): Promise<void> {
  await prisma.schemaProfile.update({
    where: { connectionId },
    data: { summary },
  });
}

/** Scoped by userId — a global count would leak other tenants' activity. */
export function countConnections(userId: string): Promise<number> {
  return prisma.connection.count({ where: { userId } });
}
