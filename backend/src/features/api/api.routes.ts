// The public, versioned, machine-to-machine API. Every route here is a thin
// adapter over the SAME services the web app uses — no pipeline logic is
// duplicated. The only differences from the web routes are the auth (API key
// instead of JWT), the per-key rate limits, and the uniform error envelope.

import { Router, type NextFunction, type Request, type Response } from "express";
import { requireApiKey } from "../apikeys/apikeys.middleware";
import { friendlyConnectionError } from "../connections/connections.errors";
import * as connectionsRepo from "../connections/connections.repository";
import * as connectionsService from "../connections/connections.service";
import { validateCreateConnection } from "../connections/connections.validation";
import { runQuery } from "../query/query.service";
import { validateAsk } from "../query/query.validation";
import { apiError } from "./api.errors";
import { rateLimitPerMinute, rateLimitQueriesPerDay } from "./api.rateLimit";

export const apiV1Router = Router();

// Authenticate first, then apply the per-minute cap to everything.
apiV1Router.use(requireApiKey);
apiV1Router.use(rateLimitPerMinute);

// Wraps an async handler so any thrown error becomes a clean 500 — no stack, no
// internal message ever reaches an API consumer.
function handle(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };
}

// POST /v1/connections — register + introspect a database.
apiV1Router.post(
  "/connections",
  handle(async (req, res) => {
    const parsed = validateCreateConnection(req.body);
    if (!parsed.ok) {
      res.status(400).json(apiError("bad_request", parsed.error));
      return;
    }

    const result = await connectionsService.createAndScan(req.userId!, parsed.value);
    if (!result.ok) {
      res.status(422).json(apiError("connection_failed", friendlyConnectionError(result.reason)));
      return;
    }

    res.status(201).json({
      connectionId: result.connection.id,
      name: result.connection.name,
      tableCount: result.connection.tableCount,
    });
  })
);

// GET /v1/connections — list the key owner's connections.
apiV1Router.get(
  "/connections",
  handle(async (req, res) => {
    const connections = await connectionsRepo.listConnections(req.userId!);
    res.json(
      connections.map((c) => ({
        id: c.id,
        name: c.name,
        tableCount: Array.isArray(c.schemaProfile?.tables) ? (c.schemaProfile!.tables as unknown[]).length : 0,
        scannedAt: c.lastScannedAt?.toISOString() ?? null,
      }))
    );
  })
);

// DELETE /v1/connections/:id — remove a connection (cascades to profile + logs).
apiV1Router.delete(
  "/connections/:id",
  handle(async (req, res) => {
    const deleted = await connectionsRepo.deleteOwnedConnection(req.userId!, req.params.id);
    if (deleted === 0) {
      res.status(404).json(apiError("not_found", "Connection not found"));
      return;
    }
    res.json({ deleted: true });
  })
);

// POST /v1/query — the full pipeline: retrieve -> generate -> validate ->
// execute -> retry loop -> present. Same answer the web app renders.
apiV1Router.post(
  "/query",
  rateLimitQueriesPerDay,
  handle(async (req, res) => {
    const parsed = validateAsk(req.body);
    if (!parsed.ok) {
      res.status(400).json(apiError("bad_request", parsed.error));
      return;
    }

    // Tenancy: 404 on a connection the key's owner doesn't have (never 403).
    const connection = await connectionsRepo.getOwnedConnection(req.userId!, parsed.value.connectionId);
    if (!connection) {
      res.status(404).json(apiError("not_found", "Connection not found"));
      return;
    }

    const outcome = await runQuery(req.userId!, connection, parsed.value.question, {
      explain: parsed.value.explain,
    });

    if (!outcome.ok) {
      if (outcome.failureType === "not_scanned") {
        res.status(404).json(apiError("not_found", outcome.detail));
        return;
      }
      // The engine ran but couldn't produce a usable answer (retries exhausted,
      // or a security rejection). A real non-2xx, with the attempt trail kept.
      res.status(422).json(
        apiError("query_failed", outcome.detail, {
          failureType: outcome.failureType,
          sql: outcome.sql,
          attempts: outcome.attempts,
        })
      );
      return;
    }

    res.json({
      rows: outcome.answer.rows,
      fields: outcome.answer.fields,
      rowCount: outcome.answer.rowCount,
      chart: outcome.answer.chart,
      explanation: outcome.answer.explanation,
      sql: outcome.answer.sql,
      attempts: outcome.attempts,
      usage: { attemptsUsed: outcome.attempts.length },
    });
  })
);

// Any error escaping a handler lands here as a generic 500 — never leaking
// the underlying message or stack to the caller.
apiV1Router.use((_err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (res.headersSent) return;
  res.status(500).json(apiError("internal", "Something went wrong"));
});
