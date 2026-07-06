import { Router } from "express";
import type { Pool } from "pg";
import { prisma } from "../db/prisma";
import { introspectSchema } from "../engine/introspect";
import type { Result, SchemaProfile } from "../engine/types";
import { friendlyConnectionError } from "../lib/connectionErrors";
import { encrypt, decrypt } from "../lib/crypto";
import { getOwnedConnection } from "../lib/ownership";
import { requireAuth } from "../middleware/requireAuth";
import { connectAndValidate } from "../userdb/pool";

export const connectionsRouter = Router();
connectionsRouter.use(requireAuth);

// Introspects on an already-validated pool and persists the result. Closes
// the pool when done — Day 1 scans once at connect/rescan time, no long-lived
// pool is kept between requests yet.
async function introspectAndPersist(pool: Pool, connectionId: string): Promise<Result<SchemaProfile>> {
  try {
    const introspectResult = await introspectSchema(pool, connectionId);
    if (!introspectResult.ok) return introspectResult;

    const profile = introspectResult.value;
    await prisma.schemaProfile.upsert({
      where: { connectionId },
      create: { connectionId, scannedAt: profile.scannedAt, tables: profile.tables as object },
      update: { scannedAt: profile.scannedAt, tables: profile.tables as object },
    });
    await prisma.connection.update({
      where: { id: connectionId },
      data: { lastScannedAt: profile.scannedAt },
    });

    return introspectResult;
  } finally {
    await pool.end().catch(() => {});
  }
}

connectionsRouter.post("/", async (req, res) => {
  const userId = req.userId!;
  const { name, connectionString } = req.body ?? {};
  if (typeof name !== "string" || typeof connectionString !== "string" || !name || !connectionString) {
    res.status(400).json({ error: "name and connectionString are required" });
    return;
  }

  const validation = await connectAndValidate(connectionString);
  if (!validation.ok) {
    res.status(422).json({ error: friendlyConnectionError(validation.reason) });
    return;
  }

  const { cipherText, iv, tag } = encrypt(connectionString);
  const connection = await prisma.connection.create({
    data: {
      userId,
      name,
      connectionStringCipher: cipherText,
      connectionStringIv: iv,
      connectionStringTag: tag,
    },
  });

  const scanResult = await introspectAndPersist(validation.value, connection.id);
  if (!scanResult.ok) {
    res.status(422).json({ error: friendlyConnectionError(scanResult.reason), id: connection.id });
    return;
  }

  res.status(201).json({ id: connection.id, name: connection.name, tableCount: scanResult.value.tables.length });
});

connectionsRouter.get("/", async (req, res) => {
  const userId = req.userId!;
  const connections = await prisma.connection.findMany({
    where: { userId },
    include: { schemaProfile: true },
    orderBy: { createdAt: "desc" },
  });

  res.json(
    connections.map((c) => ({
      id: c.id,
      name: c.name,
      tableCount: Array.isArray(c.schemaProfile?.tables) ? (c.schemaProfile!.tables as unknown[]).length : 0,
      scannedAt: c.lastScannedAt,
    }))
  );
});

connectionsRouter.get("/:id/schema", async (req, res) => {
  const userId = req.userId!;
  const connection = await getOwnedConnection(userId, req.params.id);
  if (!connection) {
    res.status(404).json({ error: "Connection not found" });
    return;
  }

  const schemaProfile = await prisma.schemaProfile.findUnique({ where: { connectionId: connection.id } });
  if (!schemaProfile) {
    res.status(404).json({ error: "This connection has not been scanned yet" });
    return;
  }

  const profile: SchemaProfile = {
    connectionId: connection.id,
    scannedAt: schemaProfile.scannedAt.toISOString(),
    tables: schemaProfile.tables as unknown as SchemaProfile["tables"],
  };
  res.json(profile);
});

connectionsRouter.post("/:id/rescan", async (req, res) => {
  const userId = req.userId!;
  const connection = await getOwnedConnection(userId, req.params.id);
  if (!connection) {
    res.status(404).json({ error: "Connection not found" });
    return;
  }

  const connectionString = decrypt({
    cipherText: connection.connectionStringCipher,
    iv: connection.connectionStringIv,
    tag: connection.connectionStringTag,
  });

  const validation = await connectAndValidate(connectionString);
  if (!validation.ok) {
    res.status(422).json({ error: friendlyConnectionError(validation.reason) });
    return;
  }

  const scanResult = await introspectAndPersist(validation.value, connection.id);
  if (!scanResult.ok) {
    res.status(422).json({ error: friendlyConnectionError(scanResult.reason) });
    return;
  }

  res.json(scanResult.value);
});
