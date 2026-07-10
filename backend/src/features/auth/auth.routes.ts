import { Router } from "express";
import { requireAuth } from "./auth.middleware";
import { allowHit } from "./auth.rateLimit";
import { createDemoSession, getProfile, login, signup } from "./auth.service";
import { validateCredentials } from "./auth.validation";

// The only unauthenticated route that writes to the database, so it gets a
// per-IP brake. 5/hour is generous for a human and useless for a script.
const DEMO_CREATIONS_PER_IP_PER_HOUR = 5;

export const authRouter = Router();

authRouter.post("/demo", async (req, res) => {
  if (!allowHit(`demo:${req.ip}`, DEMO_CREATIONS_PER_IP_PER_HOUR)) {
    res.status(429).json({ error: "Too many demo sessions from this address — try again later" });
    return;
  }

  const result = await createDemoSession();
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  res.status(201).json({ token: result.token, connectionId: result.connectionId });
});

authRouter.post("/signup", async (req, res) => {
  const parsed = validateCredentials(req.body);
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const result = await signup(parsed.value);
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  res.status(201).json({ token: result.token });
});

authRouter.post("/login", async (req, res) => {
  const parsed = validateCredentials(req.body);
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const result = await login(parsed.value);
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  res.json({ token: result.token });
});

// The only authenticated route in this feature. The id comes from the verified
// token, so a caller can only ever read their own profile.
authRouter.get("/me", requireAuth, async (req, res) => {
  const profile = await getProfile(req.userId!);
  if (!profile) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(profile);
});
