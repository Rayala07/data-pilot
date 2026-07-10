import jwt from "jsonwebtoken";
import type { TokenPayload } from "./auth.types";

const DEFAULT_EXPIRY = "7d";

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET must be set");
  return secret;
}

/** Demo sessions pass a short expiry ("2h"); everyone else gets the default. */
export function signToken(payload: TokenPayload, expiresIn: string = DEFAULT_EXPIRY): string {
  return jwt.sign(payload, getSecret(), { expiresIn: expiresIn as jwt.SignOptions["expiresIn"] });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, getSecret()) as TokenPayload;
}
