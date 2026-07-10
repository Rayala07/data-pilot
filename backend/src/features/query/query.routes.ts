import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware";
import { getOwnedConnection } from "../connections/connections.repository";
import { countQueryLogsSince } from "./query.repository";
import { runQuery } from "./query.service";
import { validateAsk } from "./query.validation";

// Demo sandboxes burn real LLM credits per query, so they get an hourly cap.
// The ledger is QueryLog itself — every attempt is already recorded for the
// benchmark, so this is a count over existing data, not new bookkeeping.
const DEMO_QUERY_LIMIT_PER_HOUR = Number(process.env.DEMO_QUERY_LIMIT_PER_HOUR ?? 30);

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

  if (req.isDemo) {
    const lastHour = await countQueryLogsSince(req.userId!, new Date(Date.now() - 60 * 60 * 1000));
    if (lastHour >= DEMO_QUERY_LIMIT_PER_HOUR) {
      res.status(429).json({
        error: "Demo limit reached for this hour — sign up for unlimited queries.",
      });
      return;
    }
  }

  const result = await runQuery(req.userId!, connection, parsed.value.question, {
    explain: parsed.value.explain,
  });
  if (!result.ok && result.failureType === "not_scanned") {
    res.status(404).json({ error: result.detail });
    return;
  }

  // A query that ran but failed validation/execution is a normal outcome, not a
  // server error — return 200 with the failure + attempts so the UI can show them.
  res.json(result);
});
