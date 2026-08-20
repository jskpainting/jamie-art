import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(cents: number | null): string {
  if (cents === null) return "—"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

// Derives a painting title from a filename.
// "Civil Disobedience (1).jpg" → "Civil Disobedience"
// "the_assembly.jpg"           → "The Assembly"
// "Vibrant Decay (1).jpg"      → "Vibrant Decay"
export function cleanFilename(filename: string): string {
  const noExt = filename.replace(/\.[^.]+$/, "")
  const noNum = noExt.replace(/\s*\(\d+\)\s*$/, "")
  const spaced = noNum.replace(/[_-]+/g, " ")
  const trimmed = spaced.replace(/\s+/g, " ").trim()
  return trimmed
    .split(" ")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ")
}

/**
 * Human-friendly event date range, condensing same-month/same-year cases:
 *   same month → "September 24 – 27, 2026"
 *   same year  → "September 30 – October 3, 2026"
 *   otherwise  → "December 30, 2025 – January 2, 2026"
 * Accepts ISO strings; returns just the start date when there's no end.
 */
/**
 * Every event on this site happens where the artist does, and an event date must
 * read the same on the server as in the visitor's browser. Formatting in the
 * runtime's own zone made those disagree — Vercel renders in UTC, the browser
 * renders in the visitor's zone — so the home page and /events advertised
 * different dates for the same show and React threw a hydration error (#418) on
 * every load for any visitor outside UTC.
 */
export const EVENT_TIME_ZONE = "America/New_York"

/** Calendar year/month/day as seen in EVENT_TIME_ZONE, not in the runtime's zone. */
function calendarPartsInEventZone(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: EVENT_TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date)
  const value = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value)
  return { year: value("year"), month: value("month"), day: value("day") }
}

export function formatEventDateRange(
  startsAt: string,
  endsAt: string | null
): string {
  const start = new Date(startsAt)
  const full = new Intl.DateTimeFormat("en-US", {
    timeZone: EVENT_TIME_ZONE,
    month: "long",
    day: "numeric",
    year: "numeric",
  })
  if (!endsAt) return full.format(start)
  const end = new Date(endsAt)
  const monthDay = new Intl.DateTimeFormat("en-US", {
    timeZone: EVENT_TIME_ZONE,
    month: "long",
    day: "numeric",
  })
  const s = calendarPartsInEventZone(start)
  const e = calendarPartsInEventZone(end)
  const sameYear = s.year === e.year
  const sameMonth = sameYear && s.month === e.month
  if (sameMonth) {
    return `${monthDay.format(start)} – ${e.day}, ${e.year}`
  }
  if (sameYear) {
    return `${monthDay.format(start)} – ${full.format(end)}`
  }
  return `${full.format(start)} – ${full.format(end)}`
}
