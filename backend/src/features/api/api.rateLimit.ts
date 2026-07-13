// Per-API-key rate limiting for /v1, as Express middleware.
//
// In-memory fixed windows, keyed by apiKeyId. This app runs as a single
// instance, and the counters are deliberately simple — no Redis, no counter
// table. The accepted tradeoff (matching the existing demo limiter) is that a
// restart resets the windows; for a public demo API that is fine.
//
// Two independent limits:
//   • per-minute request cap  — every /v1 route
//   • per-day query cap       — /v1/query only
// Counting REQUESTS (not QueryLog rows) makes the day-cap exactly "queries per
// day" rather than "attempts", and keeps it per-key rather than per-user.

import type { NextFunction, Request, Response } from "express";
import { apiError } from "./api.errors";

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const PER_MINUTE = Number(process.env.API_RATE_LIMIT_PER_MIN ?? 20);
const PER_DAY = Number(process.env.API_QUERY_LIMIT_PER_DAY ?? 200);

interface Window {
  count: number;
  resetAt: number;
}

/** One fixed-window counter store. Returns remaining seconds when over limit, else null. */
class FixedWindow {
  private windows = new Map<string, Window>();

  constructor(
    private windowMs: number,
    private limit: number
  ) {}

  /** null = allowed (and recorded); number = retryAfterSeconds when blocked. */
  check(key: string): number | null {
    const now = Date.now();
    const w = this.windows.get(key);

    if (!w || now >= w.resetAt) {
      this.windows.set(key, { count: 1, resetAt: now + this.windowMs });
      this.sweep(now);
      return null;
    }
    if (w.count >= this.limit) {
      return Math.ceil((w.resetAt - now) / 1000);
    }
    w.count += 1;
    return null;
  }

  private sweep(now: number): void {
    if (this.windows.size < 5000) return;
    for (const [k, w] of this.windows) {
      if (now >= w.resetAt) this.windows.delete(k);
    }
  }
}

const perMinute = new FixedWindow(MINUTE_MS, PER_MINUTE);
const perDayQueries = new FixedWindow(DAY_MS, PER_DAY);

function blocked(res: Response, retryAfterSeconds: number, message: string): void {
  res.setHeader("Retry-After", String(retryAfterSeconds));
  res.status(429).json(apiError("rate_limited", message, { retryAfterSeconds }));
}

/** Per-minute request cap. Applied to the whole /v1 router. */
export function rateLimitPerMinute(req: Request, res: Response, next: NextFunction): void {
  const retry = perMinute.check(req.apiKeyId!);
  if (retry !== null) {
    blocked(res, retry, `Rate limit exceeded: at most ${PER_MINUTE} requests per minute.`);
    return;
  }
  next();
}

/** Daily query cap. Applied only to POST /v1/query. */
export function rateLimitQueriesPerDay(req: Request, res: Response, next: NextFunction): void {
  const retry = perDayQueries.check(req.apiKeyId!);
  if (retry !== null) {
    blocked(res, retry, `Daily query limit exceeded: at most ${PER_DAY} queries per day.`);
    return;
  }
  next();
}
