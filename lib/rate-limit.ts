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

/** Extract a best-effort client IP from request headers. */
export function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for")
  if (fwd) return fwd.split(",")[0].trim()
  return request.headers.get("x-real-ip") ?? "unknown"
}
