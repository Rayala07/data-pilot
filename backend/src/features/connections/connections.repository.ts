// All app-DB access for the connections feature. getOwnedConnection is the
// single tenancy choke point every route uses — fetching a Connection by id
// alone is a tenancy bug (CLAUDE.md hard rule 6). A miss returns null so the
// caller can respond 404, never 403 (403 would leak that the id exists).

import type { Connection } from "@prisma/client";
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
    update: { scannedAt, tables },
  });
  await prisma.connection.update({
    where: { id: connectionId },
    data: { lastScannedAt: scannedAt },
  });
}
