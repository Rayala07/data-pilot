import { Router } from "express";
import { requireAuth } from "./auth.middleware";
import { getProfile } from "./auth.service";

export const authRouter = Router();

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
