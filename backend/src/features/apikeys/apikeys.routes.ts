// API-key MANAGEMENT, mounted on the existing web app and protected by the
// normal JWT session (requireAuth). This is where a signed-in user mints, lists
// and revokes the keys their external backends will use against /v1.
//
// Error bodies here follow the web app's simple { error: string } shape (this
// is a web route). The /v1 API has its own { error: { code, message } } shape.

import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware";
import { createKey, deleteKey, listKeys, revokeKey } from "./apikeys.service";
import { validateKeyName } from "./apikeys.validation";

export const apiKeysRouter = Router();
apiKeysRouter.use(requireAuth);

apiKeysRouter.post("/", async (req, res) => {
  const parsed = validateKeyName(req.body);
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  // The response carries the raw key - the only time it is ever returned.
  const created = await createKey(req.userId!, parsed.value.name);
  res.status(201).json(created);
});

apiKeysRouter.get("/", async (req, res) => {
  res.json(await listKeys(req.userId!));
});

apiKeysRouter.post("/:id/revoke", async (req, res) => {
  const revoked = await revokeKey(req.userId!, req.params.id);
  if (!revoked) {
    // Unknown id, not owned, or already revoked - 404 either way (don't leak existence).
    res.status(404).json({ error: "API key not found" });
    return;
  }
  res.json({ ok: true });
});

// Permanent removal, allowed only after revocation.
apiKeysRouter.delete("/:id", async (req, res) => {
  const result = await deleteKey(req.userId!, req.params.id);
  if (result === "not_found") {
    res.status(404).json({ error: "API key not found" });
    return;
  }
  if (result === "not_revoked") {
    res.status(409).json({ error: "Revoke the key before deleting it" });
    return;
  }
  res.json({ ok: true });
});
