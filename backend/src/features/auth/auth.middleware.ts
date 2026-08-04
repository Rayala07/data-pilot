import type { NextFunction, Request, Response } from "express";
import { supabase } from "../../config/supabase";
import { asyncHandler } from "../../shared/asyncHandler";
import { findUserBySupabaseId, findOrCreateUser } from "./auth.repository";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export const requireAuth = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }
  const token = authHeader.substring(7);

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  // An address is what links an auth user to their local row, so a token
  // without one can't be provisioned. Treating "" as a usable email would let
  // two such users collide on the unique index — or worse, share a row.
  if (!user.email) {
    res.status(401).json({ error: "Account has no email address" });
    return;
  }

  // Lazy-provision: the first authenticated request creates the local row, or
  // adopts one that already exists for this address.
  const dbUser =
    (await findUserBySupabaseId(user.id)) ??
    (await findOrCreateUser(user.id, user.email, user.user_metadata?.name ?? ""));

  req.userId = dbUser.id;
  next();
});
