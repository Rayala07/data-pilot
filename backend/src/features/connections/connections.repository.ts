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

/**
 * Deletes a connection the user owns. The SchemaProfile and QueryLog rows go
 * with it via onDelete: Cascade. Returns the affected count so the caller can
 * 404 on a foreign or unknown id — scoped by userId, never by id alone.
 */
export async function deleteOwnedConnection(userId: string, connectionId: string): Promise<number> {
  const result = await prisma.connection.deleteMany({ where: { id: connectionId, userId } });
  return result.count;
}

/**
 * Unscoped by design — the ONLY permitted caller is the demo-template lookup,
 * where the id comes from operator configuration (DEMO_TEMPLATE_CONNECTION_ID),
 * never from a request. Every request-driven read goes through
 * getOwnedConnection above.
 */
export function getConnectionByIdInternal(connectionId: string): Promise<Connection | null> {
  return prisma.connection.findUnique({ where: { id: connectionId } });
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

/** Records whether the stored credential can modify the user's data (null = unknown). */
export async function setCredentialWriteAccess(connectionId: string, canWrite: boolean | null): Promise<void> {
  await prisma.connection.update({
    where: { id: connectionId },
    data: { credentialCanWrite: canWrite },
  });
}

/**
 * Clones a fully-scanned connection into another user's tenant — pure row
 * copies, no LLM calls, no scan of the target database. The expensive
 * artifacts (embeddings inside `tables`, the cached `summary`) already exist,
 * which is what makes demo-sandbox creation sub-second. The encrypted
 * connection string is copied verbatim: same ENCRYPTION_KEY, same ciphertext.
 */
export async function cloneConnectionForUser(templateConnectionId: string, newUserId: string): Promise<string | null> {
  const template = await prisma.connection.findUnique({
    where: { id: templateConnectionId },
    include: { schemaProfile: true },
  });
  // An unscanned template would clone into a broken first impression — refuse.
  if (!template || !template.schemaProfile) return null;

  const clone = await prisma.connection.create({
    data: {
      userId: newUserId,
      name: template.name,
      connectionStringCipher: template.connectionStringCipher,
      connectionStringIv: template.connectionStringIv,
      connectionStringTag: template.connectionStringTag,
      credentialCanWrite: template.credentialCanWrite,
      lastScannedAt: template.lastScannedAt,
      schemaProfile: {
        create: {
          scannedAt: template.schemaProfile.scannedAt,
          tables: template.schemaProfile.tables as Prisma.InputJsonValue,
          summary: (template.schemaProfile.summary ?? Prisma.DbNull) as Prisma.InputJsonValue,
        },
      },
    },
  });
  return clone.id;
}
