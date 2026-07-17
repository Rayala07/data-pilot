import type { NextFunction, Request, Response } from "express";
import { verifyToken } from "./auth.jwt";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
      /** True for ephemeral demo-sandbox sessions (read from the JWT claim). */
      isDemo?: boolean;
      /** The /demo?ref=... tag for this session. Telemetry only. */
      demoRef?: string;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;

  if (!token) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }

  try {
    const payload = verifyToken(token);
    req.userId = payload.userId;
    req.isDemo = payload.demo === true;
    req.demoRef = payload.ref;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
