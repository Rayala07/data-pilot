import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware";
import { getOwnedConnection } from "../connections/connections.repository";
import { runQuery } from "./query.service";
import { validateAsk } from "./query.validation";

export const queryRouter = Router();
queryRouter.use(requireAuth);

queryRouter.post("/", async (req, res) => {
  const parsed = validateAsk(req.body);
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  // Tenancy: the connection must belong to the caller (404 on a miss, per hard rule 6).
  const connection = await getOwnedConnection(req.userId!, parsed.value.connectionId);
  if (!connection) {
    res.status(404).json({ error: "Connection not found" });
    return;
  }

  const result = await runQuery(req.userId!, connection, parsed.value.question, {
    explain: parsed.value.explain,
    maxAttempts: parsed.value.maxAttempts,
  });
  if (!result.ok && result.failureType === "not_scanned") {
    res.status(404).json({ error: result.detail });
    return;
  }

  // A query that ran but failed validation/execution is a normal outcome, not a
  // server error - return 200 with the failure + attempts so the UI can show them.
  res.json(result);
});
