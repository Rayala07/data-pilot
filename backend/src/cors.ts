import type { CorsOptions } from "cors";

/**
 * Origin policy.
 *
 * `cors({ origin: "http://localhost:3000" })` does NOT validate the caller - it
 * writes that string into Access-Control-Allow-Origin unconditionally. So a
 * browser on any other origin (Next falling back to :3001 when :3000 is taken,
 * or the user typing 127.0.0.1 instead of localhost - a different origin) gets
 * back a header that doesn't match itself, and blocks the request. That reads
 * as "a CORS error" but is really a misconfigured allowlist.
 *
 * Instead: check the request's origin and echo it back only if it's allowed.
 *
 * FRONTEND_URL may be a comma-separated list. In development any loopback port
 * is accepted, because which port Next lands on isn't ours to control. In
 * production only the configured origins pass.
 */
const LOOPBACK = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

export function corsOptions(): CorsOptions {
  const allowlist = (process.env.FRONTEND_URL ?? "http://localhost:3000")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const isProduction = process.env.NODE_ENV === "production";

  return {
    origin(origin, callback) {
      // No Origin header: curl, health checks, server-to-server. Not a browser,
      // so the same-origin policy isn't in play and there's nothing to protect.
      if (!origin) return callback(null, true);

      if (allowlist.includes(origin)) return callback(null, true);
      if (!isProduction && LOOPBACK.test(origin)) return callback(null, true);

      // Deny by omitting the header rather than throwing: the browser blocks the
      // request (which is the point), and we don't turn every probe into a 500.
      return callback(null, false);
    },
  };
}
