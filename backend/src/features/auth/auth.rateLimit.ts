// Tiny fixed-window rate limiter for the demo endpoint.
//
// In-memory on purpose: this app deploys as a single instance, and the demo
// endpoint is the only unauthenticated route that WRITES to the database, so
// it needs a brake that doesn't depend on any other infrastructure. If the
// backend ever scales horizontally, this becomes per-instance and should move
// to something shared - that limitation is accepted, not overlooked.

const WINDOW_MS = 60 * 60 * 1000;

const hits = new Map<string, number[]>();

/** True if `key` (an IP) has capacity left; records the hit if so. */
export function allowHit(key: string, limit: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);

  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }

  recent.push(now);
  hits.set(key, recent);

  // Opportunistic sweep so abandoned IPs don't accumulate forever.
  if (hits.size > 1000) {
    for (const [k, times] of hits) {
      if (times.every((t) => now - t >= WINDOW_MS)) hits.delete(k);
    }
  }
  return true;
}
