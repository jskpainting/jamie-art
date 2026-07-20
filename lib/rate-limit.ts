// Best-effort in-memory rate limiter for public endpoints.
// Note: on serverless each warm instance has its own map, so this throttles
// naive single-source loops but is not a hard guarantee. For production scale,
// front these routes with a managed limiter (e.g. Upstash) — see docs/DEPLOY.md.

type Hit = { count: number; resetAt: number }
const buckets = new Map<string, Hit>()

/** Returns true if the request is allowed, false if the limit is exceeded. */
export function rateLimit(
  key: string,
  { limit = 5, windowMs = 60_000 }: { limit?: number; windowMs?: number } = {}
): boolean {
  const now = Date.now()
  const hit = buckets.get(key)

  if (!hit || now > hit.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    // Opportunistic cleanup so the map can't grow unbounded.
    if (buckets.size > 5000) {
      for (const [k, v] of buckets) if (now > v.resetAt) buckets.delete(k)
    }
    return true
  }

  if (hit.count >= limit) return false
  hit.count += 1
  return true
}

/**
 * Extract a best-effort client IP, preferring sources the hosting platform
 * (Vercel) sets itself and the client cannot spoof.
 *
 * SECURITY: never trust the leftmost `x-forwarded-for` entry — it is fully
 * client-controlled, so keying the limiter on it lets an attacker send a random
 * value per request and get a fresh bucket every time. Vercel sets
 * `x-vercel-forwarded-for` / `x-real-ip` at the edge (overwriting any client
 * value); use those. For non-Vercel/local fallback, take the RIGHTMOST XFF hop
 * (closest trusted proxy) rather than the leftmost.
 */
export function clientIp(request: Request): string {
  const vercel = request.headers.get("x-vercel-forwarded-for")
  if (vercel) return vercel.split(",")[0].trim()

  const real = request.headers.get("x-real-ip")
  if (real) return real.trim()

  const fwd = request.headers.get("x-forwarded-for")
  if (fwd) {
    const hops = fwd.split(",").map((s) => s.trim()).filter(Boolean)
    if (hops.length) return hops[hops.length - 1]
  }
  return "unknown"
}
