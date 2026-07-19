import type { Event } from "@/lib/types"

export type EventBucket = "current" | "upcoming" | "past"

const ONE_DAY_MS = 86_400_000

/**
 * Decide which bucket an event belongs to.
 * Manual status wins as an override:
 *   - status "current" → always "On View Now"
 *   - status "past"    → always Past
 *   - status "cancelled" → callers should skip these (returns "past" as a safe default)
 * Otherwise (status "upcoming") the bucket is derived from the dates so a show
 * whose date range spans today automatically appears as "On View Now", and a show
 * whose dates have fully passed automatically ages into Past.
 */
export function bucketOf(e: Event, now: number): EventBucket {
  if (e.status === "current") return "current"
  if (e.status === "past") return "past"
  const start = new Date(e.starts_at).getTime()
  const end = e.ends_at ? new Date(e.ends_at).getTime() : start + ONE_DAY_MS
  if (start <= now && now <= end) return "current"
  if (start > now) return "upcoming"
  return "past"
}

/** Split non-cancelled events into current / upcoming / past, each sorted sensibly. */
export function bucketEvents(events: Event[], now: number = Date.now()): {
  current: Event[]
  upcoming: Event[]
  past: Event[]
} {
  const current: Event[] = []
  const upcoming: Event[] = []
  const past: Event[] = []

  for (const e of events) {
    if (e.status === "cancelled") continue
    const b = bucketOf(e, now)
    if (b === "current") current.push(e)
    else if (b === "upcoming") upcoming.push(e)
    else past.push(e)
  }

  const byStartAsc = (a: Event, b: Event) =>
    new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
  const byStartDesc = (a: Event, b: Event) =>
    new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime()

  current.sort(byStartAsc)
  upcoming.sort(byStartAsc)
  past.sort(byStartDesc)

  return { current, upcoming, past }
}
