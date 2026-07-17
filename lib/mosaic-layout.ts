/**
 * Structured masonry gallery layout. Design direction refined with Fable.
 *
 * A small fixed column grid (4 on desktop) so every tile aligns to just a few
 * positions — reads as an ordered wall, not scattered. Nothing is cropped
 * (height follows the image's true aspect, so tall paintings read tall). Size
 * relevance is a restrained TWO tiers: the largest canvases span two columns and
 * clearly read bigger; everything else is one column. Masonry-packed (shortest
 * column) so it stays gapless and the bottom edge stays reasonably level.
 * Deterministic / SSR-safe.
 */

export const MOSAIC = {
  cols: { desktop: 4, tablet: 3, mobile: 2 },
  gap: { desktop: 32, tablet: 24, mobile: 16 },
  /** Physical width (inches) at/above which a canvas spans two columns. */
  span2MinInches: 30,
  /** Vertical room reserved below each image for its wall label. */
  captionPx: 56,
} as const

export type Breakpoint = "desktop" | "tablet" | "mobile"

export function bpFor(w: number): Breakpoint {
  if (w < 640) return "mobile"
  if (w < 1024) return "tablet"
  return "desktop"
}

/** Parse [widthIn, heightIn] from a dimensions string like `24"x36"`. */
export function parsePhysical(
  dimensions: string | null | undefined
): [number, number] | null {
  if (!dimensions) return null
  const nums = (dimensions.match(/\d+(?:\.\d+)?/g) ?? []).map(Number)
  if (nums.length < 2 || nums[0] <= 0 || nums[1] <= 0) return null
  return [nums[0], nums[1]]
}

export interface MosaicItemInput {
  /** Physical size in inches [w, h], null if unknown. */
  physical: [number, number] | null
  /** Pixel aspect ratio (width / height) — the image's true shape. */
  aspect: number
}

export interface MosaicTile {
  index: number
  x: number
  y: number
  w: number
  h: number
}

export interface MosaicLayout {
  tiles: MosaicTile[]
  height: number
  bp: Breakpoint
}

export function layoutMosaic(
  items: MosaicItemInput[],
  W: number
): MosaicLayout {
  const bp = bpFor(W)
  const cols = MOSAIC.cols[bp]
  const gap = MOSAIC.gap[bp]
  const colW = (W - (cols - 1) * gap) / cols
  const pitch = colW + gap

  const colBottom = new Array<number>(cols).fill(0)
  const tiles: MosaicTile[] = []

  items.forEach((it, index) => {
    const physW = it.physical ? it.physical[0] : null
    const span =
      physW != null && physW >= MOSAIC.span2MinInches && cols >= 2 ? 2 : 1

    const w = span * colW + (span - 1) * gap
    const aspect =
      it.aspect > 0
        ? it.aspect
        : it.physical
          ? it.physical[0] / it.physical[1]
          : 1
    const h = w / aspect

    // Place in the column-set with the lowest top (leftmost tie-break) so the
    // masonry stays gapless and balanced.
    let bestS = 0
    let bestTop = Infinity
    for (let s = 0; s + span <= cols; s++) {
      let top = 0
      for (let c = s; c < s + span; c++) top = Math.max(top, colBottom[c])
      if (top < bestTop - 0.01) {
        bestTop = top
        bestS = s
      }
    }

    const x = bestS * pitch
    const y = bestTop
    const advance = y + h + MOSAIC.captionPx + gap
    for (let c = bestS; c < bestS + span; c++) colBottom[c] = advance

    tiles.push({ index, x, y, w, h })
  })

  const height = Math.max(0, ...colBottom) - gap
  return { tiles, height, bp }
}
