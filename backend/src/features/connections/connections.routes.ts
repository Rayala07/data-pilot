import { Router } from "express";
import type { SchemaProfile } from "../../engine/types";
import { requireAuth } from "../auth/auth.middleware";
import { friendlyConnectionError } from "./connections.errors";
import * as repo from "./connections.repository";
import * as service from "./connections.service";
import type { ConnectionSummary } from "./connections.types";
import { validateCreateConnection } from "./connections.validation";

export const connectionsRouter = Router();
connectionsRouter.use(requireAuth);

connectionsRouter.post("/", async (req, res) => {
  const parsed = validateCreateConnection(req.body);
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const result = await service.createAndScan(req.userId!, parsed.value);
  if (!result.ok) {
    res.status(422).json({
      error: friendlyConnectionError(result.reason),
      ...(result.connectionId ? { id: result.connectionId } : {}),
    });
    return;
  }

  res.status(201).json(result.connection);
});

connectionsRouter.get("/", async (req, res) => {
  const connections = await repo.listConnections(req.userId!);
  const summaries: ConnectionSummary[] = connections.map((c) => ({
    id: c.id,
    name: c.name,
    tableCount: Array.isArray(c.schemaProfile?.tables) ? (c.schemaProfile!.tables as unknown[]).length : 0,
    scannedAt: c.lastScannedAt,
  }));
  res.json(summaries);
});

connectionsRouter.get("/:id/schema", async (req, res) => {
  const connection = await repo.getOwnedConnection(req.userId!, req.params.id);
  if (!connection) {
    res.status(404).json({ error: "Connection not found" });
    return;
  }

  const schemaProfile = await repo.getSchemaProfile(connection.id);
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
  const connection = await repo.getOwnedConnection(req.userId!, req.params.id);
  if (!connection) {
    res.status(404).json({ error: "Connection not found" });
    return;
  }

  const result = await service.rescan(connection);
  if (!result.ok) {
    res.status(422).json({ error: friendlyConnectionError(result.reason) });
    return;
  }

  res.json(result.value);
});
