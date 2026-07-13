// Authenticates a request by API key (the public /v1 surface), the second of
// the app's two auth systems. It attaches req.userId exactly as the JWT
// middleware does, so downstream tenancy logic is identical regardless of how
// the caller authenticated.
//
// The two systems don't cross by construction: a JWT is not a stored key hash,
// and an API key is not a valid JWT — each middleware simply rejects the
// other's credential with its own 401.

import type { NextFunction, Request, Response } from "express";
import { apiError } from "../api/api.errors";
import { findActiveKeyByHash, touchLastUsed } from "./apikeys.repository";
import { hashKey } from "./apikeys.service";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Present only on API-key-authenticated (/v1) requests. */
      apiKeyId?: string;
    }
  }
}

export async function requireApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  const presented = header?.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : undefined;

  // One message for missing, malformed, unknown, and revoked keys alike —
  // never reveal which. An attacker learns only "not authenticated".
  const reject = () => res.status(401).json(apiError("unauthorized", "Invalid or missing API key"));

  if (!presented) {
    reject();
    return;
  }

  const key = await findActiveKeyByHash(hashKey(presented));
  if (!key) {
    reject();
    return;
  }

  req.userId = key.userId;
  req.apiKeyId = key.id;

  // Fire-and-forget: usage tracking must not add latency or a failure mode to
  // the request it's tracking.
  void touchLastUsed(key.id);

  next();
}
