import { Router } from "express";
import { requireAuth } from "./auth.middleware";
import { getProfile, login, signup } from "./auth.service";
import { validateCredentials } from "./auth.validation";

export const authRouter = Router();

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
