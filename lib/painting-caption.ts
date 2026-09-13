// The one-line caption the owner writes for every painting, e.g.
//   What Remains Standing (2026). 12"x36" Acrylic on canvas. $875 (+tax)
//   Vortex (2023). 36"x36" Acrylic on canvas. SOLD
// It is derived from the structured fields so the show card, the painting
// page and the stored `story` all say exactly the same thing. Keep the
// Python backfill in scripts/backfill-captions.py in sync with this.

export interface CaptionSource {
  title: string
  year: number | null
  dimensions: string | null
  medium: string | null
  price_cents: number | null
  status: "available" | "sold" | "nfs" | "reserved" | string
}

/** `12” x 36”` → `12"x36"` (straight quotes, no spaces, lowercase x). */
export function normalizeDimensions(raw: string | null | undefined): string | null {
  if (!raw) return null
  const s = raw
    .replace(/[“”″]/g, '"')
    .replace(/[′’']/g, '"') // a stray foot mark on a canvas size is always a typo for inches
    .replace(/[×X]/g, "x")
    .replace(/\s+/g, "")
    .trim()
  return s || null
}

export function formatPriceLine(p: Pick<CaptionSource, "price_cents" | "status">): string {
  if (p.status === "sold") return "SOLD"
  if (p.status === "nfs") return "Not for sale"
  if (p.status === "reserved") return "Reserved"
  if (p.price_cents && p.price_cents > 0) {
    const dollars = p.price_cents / 100
    const shown = Number.isInteger(dollars)
      ? dollars.toLocaleString("en-US")
      : dollars.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    return `$${shown} (+tax)`
  }
  return ""
}

/** Full caption line. */
export function captionFor(p: CaptionSource): string {
  const head = `${p.title.trim()}${p.year ? ` (${p.year})` : ""}.`
  const dims = normalizeDimensions(p.dimensions)
  const medium = (p.medium ?? "").trim()
  const mid = [dims, medium].filter(Boolean).join(" ")
  const tail = formatPriceLine(p)
  return [head, mid ? `${mid}.` : "", tail].filter(Boolean).join(" ")
}

/** The part after the title, for the show card: `(2026). 12"x36" Acrylic on canvas. $875 (+tax)` */
export function captionDetailsFor(p: CaptionSource): string {
  const dims = normalizeDimensions(p.dimensions)
  const medium = (p.medium ?? "").trim()
  const mid = [dims, medium].filter(Boolean).join(" ")
  const tail = formatPriceLine(p)
  return [p.year ? `(${p.year}).` : "", mid ? `${mid}.` : "", tail].filter(Boolean).join(" ")
}

/**
 * True when a stored story is "just the caption" (possibly in the owner's
 * older hand-written punctuation) rather than real prose — used to decide
 * whether saving a painting may refresh it automatically.
 */
export function looksLikeCaption(story: string | null | undefined): boolean {
  if (!story) return true
  const s = story.trim()
  if (s.length > 160 || s.split("\n").length > 2) return false
  return /\(\d{4}\)/.test(s) || /on canvas/i.test(s)
}
