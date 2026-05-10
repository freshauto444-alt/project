/**
 * In-memory rate limiter (token bucket per key).
 *
 * Not Redis-backed — only protects a single Node process. For prod with multiple
 * instances, swap to Upstash/Vercel KV. For a single-server site this is fine.
 *
 * Load test showed: Anthropic account limit is 50 req/min. We should cap our
 * AI endpoints at ~30 req/min per IP to leave headroom.
 */

type Bucket = { tokens: number; lastRefill: number }
const buckets = new Map<string, Bucket>()

/** Acquire 1 token for `key`. Returns { ok, resetIn } — resetIn is seconds until next token. */
export function tryAcquire(key: string, rpm: number): { ok: boolean; resetIn: number } {
  const now = Date.now()
  const refillMs = 60_000 / rpm
  const bucket = buckets.get(key) ?? { tokens: rpm, lastRefill: now }

  // Refill based on elapsed time
  const elapsed = now - bucket.lastRefill
  const refilled = Math.min(rpm, bucket.tokens + elapsed / refillMs)
  bucket.tokens = refilled
  bucket.lastRefill = now

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1
    buckets.set(key, bucket)
    return { ok: true, resetIn: 0 }
  }
  buckets.set(key, bucket)
  const resetIn = Math.ceil((1 - bucket.tokens) * refillMs / 1000)
  return { ok: false, resetIn }
}

/** Extract an identifier for rate-limiting from an incoming Request. */
export function clientKey(req: Request): string {
  // Trust X-Forwarded-For on Vercel/Cloudflare; fallback to unknown.
  const xff = req.headers.get("x-forwarded-for")
  if (xff) return xff.split(",")[0].trim()
  const real = req.headers.get("x-real-ip")
  if (real) return real.trim()
  return "unknown"
}

/** Periodically prune old buckets (prevent unbounded memory growth). */
let pruneInterval: NodeJS.Timeout | null = null
if (typeof process !== "undefined" && !pruneInterval) {
  pruneInterval = setInterval(() => {
    const now = Date.now()
    for (const [k, b] of buckets) {
      // Haven't been touched in 10 minutes → forget.
      if (now - b.lastRefill > 600_000) buckets.delete(k)
    }
  }, 300_000)
  if (pruneInterval.unref) pruneInterval.unref()  // don't keep process alive
}
