/**
 * "Two per row" gallery layout — the shipped portfolio layout.
 *
 * Always two paintings per row (one on mobile). Size is driven by each piece's
 * physical HEIGHT (height is the priority signal), so a taller canvas reads
 * taller; width follows from the image's true aspect, so the full painting always
 * shows and nothing is cropped. A pair that would overflow the row is scaled down
 * uniformly to fit (preserving the height difference between the two). Rows are
 * baseline-aligned so the two pieces face each other and the size difference is
 * obvious. Works automatically for any upload. Deterministic / SSR-safe.
 */

export const PAIRS = {
  k: 0.7, // dampening on the height ratio
  baseFrac: { desktop: 0.46, tablet: 0.46, mobile: 0.82 }, // median tile height as a fraction of W
  perRow: { desktop: 2, tablet: 2, mobile: 1 },
  gap: { desktop: 40, tablet: 32, mobile: 16 },
  rowGap: 64,
  medianLo: 14,
  medianHi: 30,
  maxHeightFrac: 0.9, // a single tile height never exceeds this fraction of W
  floorPx: 150, // legibility floor
  captionPx: 56,
} as const

export type Breakpoint = "desktop" | "tablet" | "mobile"

export function bpFor(w: number): Breakpoint {
  if (w < 640) return "mobile"
  if (w < 1024) return "tablet"
  return "desktop"
}

const clamp = (x: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, x))

function median(xs: number[]): number {
  if (xs.length === 0) return 24
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export interface PairsItemInput {
  /** Physical HEIGHT in inches, null if unknown → uses collection median. */
  physHeightInches: number | null
  /** Pixel aspect ratio (width / height) — the image's true shape. */
  aspect: number
}

export interface PairsTile {
  index: number
  w: number
  h: number
}

export interface PairsRow {
  tiles: PairsTile[]
}

export interface PairsLayout {
  rows: PairsRow[]
  bp: Breakpoint
}

export function layoutPairs(items: PairsItemInput[], W: number): PairsLayout {
  const bp = bpFor(W)
  const perRow = PAIRS.perRow[bp]
  const gap = PAIRS.gap[bp]
  const baseH = PAIRS.baseFrac[bp] * W
  const maxH = PAIRS.maxHeightFrac * W

  const knownHeights = items
    .map((i) => i.physHeightInches)
    .filter((x): x is number => x != null && x > 0)
  const Mh = clamp(median(knownHeights), PAIRS.medianLo, PAIRS.medianHi)

  const sized: PairsTile[] = items.map((it, index) => {
    const H = it.physHeightInches ?? Mh
    const aspect = it.aspect > 0 ? it.aspect : 1
    // Height is the driver (dampened by k); width follows the true aspect.
    let h = clamp(baseH * Math.pow(H / Mh, PAIRS.k), PAIRS.floorPx, maxH)
    let w = h * aspect
    // A single very-wide piece can never exceed the row width on its own.
    if (w > W) {
      h *= W / w
      w = W
    }
    return { index, w, h }
  })

  const rows: PairsRow[] = []
  for (let i = 0; i < sized.length; i += perRow) {
    const row = sized.slice(i, i + perRow).map((t) => ({ ...t }))
    const total =
      row.reduce((s, t) => s + t.w, 0) + gap * (row.length - 1)
    if (total > W) {
      const s = W / total
      for (const t of row) {
        t.w *= s
        t.h *= s
      }
    }
    rows.push({ tiles: row })
  }

  return { rows, bp }
}
