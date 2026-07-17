/**
 * "Two per row" gallery layout — the shipped portfolio layout. Framework by Fable
 * (stress-tested for arbitrary future uploads).
 *
 * Paintings lay out at most two per row (one on mobile), each sized to its REAL
 * physical dimensions (dampened) so bigger canvases read bigger and nothing is
 * cropped. Guards keep it organized automatically no matter what gets uploaded:
 *   - oversized pieces (dispLong > 0.60·W) and extreme aspects (panorama/skinny)
 *     take their own full-width row instead of collapsing a pair;
 *   - mismatched pairs (height ratio > 2.6) break so the tall one goes solo;
 *   - a lone trailing item becomes a deliberate solo, never a half-width float;
 *   - solos are capped, and every piece has a legibility floor.
 * Rows are baseline-aligned so captions line up. Deterministic / SSR-safe.
 */

export const PAIRS = {
  k: 0.7,
  baseFrac: { desktop: 0.46, tablet: 0.46, mobile: 0.9 },
  perRow: { desktop: 2, tablet: 2, mobile: 1 },
  gap: { desktop: 40, tablet: 32, mobile: 16 },
  rowGap: 64,
  soloRowGap: 84,
  medianLo: 18,
  medianHi: 30,
  soloWidthFrac: 0.72, // dispLong above this fraction of W → own row (G1); ~48"+ only, so most work still pairs
  soloAspectWide: 2.2, // aspect ≥ this → own row (G2)
  soloAspectTall: 0.45, // aspect ≤ this → own row (G2)
  mismatchRatio: 2.6, // pair height ratio above this breaks the pair (G4)
  soloCapWFrac: 0.82, // solo width cap (G5)
  soloCapHFrac: 0.68, // solo height cap (G5)
  floorPx: 160, // legibility floor (G6)
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
  /** Physical long side in inches, null if unknown → uses collection median. */
  longSideInches: number | null
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
  solo: boolean
}

export interface PairsLayout {
  rows: PairsRow[]
  bp: Breakpoint
}

export function layoutPairs(items: PairsItemInput[], W: number): PairsLayout {
  const bp = bpFor(W)
  const perRow = PAIRS.perRow[bp]
  const gap = PAIRS.gap[bp]
  const base = PAIRS.baseFrac[bp] * W
  const soloWidth = PAIRS.soloWidthFrac * W
  const capW = PAIRS.soloCapWFrac * W
  const capH = PAIRS.soloCapHFrac * W

  const knownLongs = items
    .map((i) => i.longSideInches)
    .filter((x): x is number => x != null && x > 0)
  const M = clamp(median(knownLongs), PAIRS.medianLo, PAIRS.medianHi)

  interface Sized {
    index: number
    w: number
    h: number
    forceSolo: boolean
  }

  const sized: Sized[] = items.map((it, index) => {
    const L = it.longSideInches ?? M
    const aspect = it.aspect > 0 ? it.aspect : 1
    const dispLong = Math.max(base * Math.pow(L / M, PAIRS.k), PAIRS.floorPx)
    const w = aspect >= 1 ? dispLong : dispLong * aspect
    const h = aspect >= 1 ? dispLong / aspect : dispLong
    const forceSolo =
      perRow > 1 &&
      (dispLong > soloWidth ||
        aspect >= PAIRS.soloAspectWide ||
        aspect <= PAIRS.soloAspectTall)
    return { index, w, h, forceSolo }
  })

  const soloTile = (t: Sized): PairsTile => {
    let s = 1
    if (t.w > capW) s = Math.min(s, capW / t.w)
    if (t.h > capH) s = Math.min(s, capH / t.h)
    return { index: t.index, w: t.w * s, h: t.h * s }
  }

  const rows: PairsRow[] = []
  let i = 0
  while (i < sized.length) {
    const a = sized[i]
    const b = i + 1 < sized.length ? sized[i + 1] : null

    // Solo when: mobile, forced (size/aspect), no partner left, next is a forced
    // solo, or the pair is too mismatched in height.
    const mismatched =
      b && Math.max(a.h, b.h) / Math.min(a.h, b.h) > PAIRS.mismatchRatio
    if (perRow === 1 || a.forceSolo || !b || b.forceSolo || mismatched) {
      rows.push({ tiles: [soloTile(a)], solo: true })
      i += 1
      continue
    }

    // Normal pair — scale down to fit if it would overflow (never scale up).
    const pair = [
      { index: a.index, w: a.w, h: a.h },
      { index: b.index, w: b.w, h: b.h },
    ]
    const total = pair[0].w + gap + pair[1].w
    if (total > W) {
      const s = W / total
      for (const t of pair) {
        t.w *= s
        t.h *= s
      }
    }
    rows.push({ tiles: pair, solo: false })
    i += 2
  }

  return { rows, bp }
}
