import type { NextFunction, Request, Response } from "express";
import { supabase } from "../../config/supabase";
import { findUserBySupabaseId, createUser } from "./auth.repository";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
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

  let dbUser = await findUserBySupabaseId(user.id);
  if (!dbUser) {
    // Lazy-provision: first authenticated request creates the local user row.
    dbUser = await createUser(user.id, user.email ?? "", user.user_metadata?.name ?? "");
  }

  req.userId = dbUser.id;
  next();
}
