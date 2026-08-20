"use client"

// "Will it fit?" wall preview (design plan IE-4).
//
// Renders THIS painting alongside a few real neighbours through the exact
// same layoutPairs() the live public gallery uses, so the preview and the
// real wall can never drift. Pairs layout only for now — active_layout could
// pick mosaic/columns instead in a future pass, but pairs is the shipped
// default (see BUILD_SPEC.md decisions log).

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { layoutPairs, PAIRS, type PairsItemInput } from "@/lib/pairs-layout"
import { parsePhysical } from "@/lib/mosaic-layout"
import { aspectOf } from "@/components/gallery/gallery-shared"
import { paintingAlt } from "@/lib/site"
import { loadImageDims } from "@/lib/image-edit"
import { cn } from "@/lib/utils"
import type { Painting } from "@/lib/types"

// Fixed width, deliberately not container-measured — deterministic and
// matches the compact admin panel this mounts into.
const PREVIEW_WIDTH = 560

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

/** Best small-integer approximation of a ratio, e.g. 0.667 -> "2:3". */
function approxRatioLabel(ratio: number): string {
  let bestN = 1
  let bestD = 1
  let bestErr = Infinity
  for (let d = 1; d <= 12; d++) {
    const n = Math.round(ratio * d)
    if (n < 1) continue
    const err = Math.abs(ratio - n / d)
    if (err < bestErr) {
      bestErr = err
      bestN = n
      bestD = d
    }
  }
  const g = gcd(bestN, bestD) || 1
  return `${bestN / g}:${bestD / g}`
}

export interface WallFitPreviewProps {
  /** URL of the primary photo — may be a fresh (unsaved) upload. */
  imageUrl: string | null
  /** Pixel aspect ratio (width / height) of the primary photo, null if unknown. */
  imageAspect: number | null
  /** Free-text dimensions from the form, e.g. `24" x 36"`. */
  dimensions: string | null
  /** Other paintings already in this section, used as scale reference. */
  neighbors: Painting[]
  /** Excludes this painting from `neighbors` when re-editing an existing one. */
  excludeId?: string | null
}

export function WallFitPreview({
  imageUrl,
  imageAspect,
  dimensions,
  neighbors,
  excludeId,
}: WallFitPreviewProps) {
  const physical = parsePhysical(dimensions)
  const physHeightInches = physical ? physical[1] : null
  const physAspect = physical ? physical[0] / physical[1] : null

  // `imageAspect` (from stored width/height columns) is null for the ~85
  // legacy paintings uploaded before those columns existed. Fall back to
  // measuring the photo's natural pixel size client-side — keyed on
  // `imageUrl` only, so it re-measures per photo (not per keystroke in the
  // dimensions field) and is memoized for the life of that URL.
  // Keyed by the URL it was measured for, so a stale result from a previous
  // photo is never shown while a new one is loading (and so "measuring" can
  // be derived instead of tracked as its own synchronous effect setState).
  const [measured, setMeasured] = useState<{
    url: string
    dims: { width: number; height: number } | null
  } | null>(null)

  // Already have real pixel dims from the stored width/height columns —
  // nothing to measure.
  const needsMeasure = !(imageAspect && imageAspect > 0) && !!imageUrl

  useEffect(() => {
    if (!needsMeasure || !imageUrl) return
    let cancelled = false
    loadImageDims(imageUrl).then(
      (dims) => {
        if (cancelled) return
        setMeasured({ url: imageUrl, dims })
      },
      () => {
        // Failed to load (network error, or a cross-origin source without
        // CORS headers) — degrade to the pre-fix silent state rather than
        // erroring or showing a wrong warning.
        if (cancelled) return
        setMeasured({ url: imageUrl, dims: null })
      }
    )
    return () => {
      cancelled = true
    }
    // Deliberately keyed on imageUrl (and needsMeasure) only — re-measures
    // per photo, not on every keystroke in the dimensions field.
  }, [imageUrl, needsMeasure])

  const measuredDims = needsMeasure && measured && measured.url === imageUrl ? measured.dims : null
  const stillMeasuring = needsMeasure && !(measured && measured.url === imageUrl)

  const measuredAspect =
    measuredDims && measuredDims.height > 0 ? measuredDims.width / measuredDims.height : null
  const effectiveImageAspect = imageAspect && imageAspect > 0 ? imageAspect : measuredAspect

  const thisAspect = effectiveImageAspect ?? physAspect ?? 4 / 3

  const others = useMemo(
    () => neighbors.filter((n) => n.id !== excludeId).slice(0, 5),
    [neighbors, excludeId]
  )

  const layout = useMemo(() => {
    const thisInput: PairsItemInput = { physHeightInches, aspect: thisAspect }
    const otherInputs: PairsItemInput[] = others.map((n) => {
      const d = parsePhysical(n.dimensions)
      return { physHeightInches: d ? d[1] : null, aspect: aspectOf(n) }
    })
    return layoutPairs([thisInput, ...otherInputs], PREVIEW_WIDTH)
  }, [physHeightInches, thisAspect, others])

  const rows = layout.rows.slice(0, 2)
  const gapPx = PAIRS.gap[layout.bp]

  // Warnings, in priority order.
  let warning: { tone: "amber" | "strong" | "ok"; text: string } | null = null
  if (!physical) {
    warning = {
      tone: "amber",
      text: "No size set — this painting will display at a guessed size and shape (4:3). Add dimensions above to fix it.",
    }
  } else if (stillMeasuring) {
    // Don't flash a wrong warning while we're still measuring a legacy
    // photo's natural size — say nothing until we know.
    warning = null
  } else if (effectiveImageAspect && effectiveImageAspect > 0 && physAspect) {
    const crossed = (effectiveImageAspect - 1) * (physAspect - 1) < 0
    const pctOff = Math.abs(effectiveImageAspect / physAspect - 1)
    const physLabel = `${physical[0]} × ${physical[1]}`
    if (pctOff > 0.03) {
      warning = crossed
        ? {
            tone: "strong",
            text: `The photo's shape (roughly ${approxRatioLabel(effectiveImageAspect)}) doesn't match the painting's ${physLabel} — it looks rotated, or the width and height may be swapped.`,
          }
        : {
            tone: "amber",
            text: `The photo's shape (roughly ${approxRatioLabel(effectiveImageAspect)}) doesn't match the painting's ${physLabel}. On the wall it will show the photo's shape — use Edit → Match painting shape.`,
          }
    } else {
      warning = { tone: "ok", text: "Sized correctly next to your other work ✓" }
    }
  }

  // Read-only pixel-size readout — shows the data exists (esp. for legacy
  // paintings where it's measured on the fly, not stored) without inviting
  // manual override. Prefer the stored dims when present, else what we just
  // measured from the photo itself.
  const pixelDims = measuredDims

  return (
    <div className="space-y-3">
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        Shown to relative scale
      </p>

      <div
        className="w-full flex flex-col items-center overflow-hidden"
        style={{ maxWidth: PREVIEW_WIDTH }}
      >
        {rows.map((row, ri) => (
          <div
            key={ri}
            className="flex items-end justify-center w-full"
            style={{
              columnGap: gapPx,
              marginBottom: ri === rows.length - 1 ? 0 : PAIRS.rowGap / 2,
            }}
          >
            {row.tiles.map((t) => {
              const isThis = t.index === 0
              const neighbor = isThis ? null : others[t.index - 1]
              const src = isThis ? imageUrl : (neighbor?.primary_image_url ?? null)
              return (
                <div
                  key={t.index}
                  className={cn(
                    "relative overflow-hidden bg-muted/40 shrink-0",
                    isThis ? "ring-2 ring-foreground" : "opacity-40"
                  )}
                  style={{ width: Math.round(t.w), height: Math.round(t.h) }}
                >
                  {src ? (
                    <Image
                      src={src}
                      alt={isThis ? "This painting" : paintingAlt(neighbor?.title ?? "")}
                      fill
                      sizes="280px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="h-full w-full bg-muted" />
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {stillMeasuring && (
        <p className="text-xs text-muted-foreground">Measuring photo…</p>
      )}

      {warning && (
        <p
          className={cn(
            "text-xs leading-relaxed",
            warning.tone === "amber" && "text-amber-600 dark:text-amber-500",
            warning.tone === "strong" && "text-destructive",
            warning.tone === "ok" && "text-muted-foreground"
          )}
        >
          {warning.text}
        </p>
      )}

      {pixelDims && (
        <p className="text-xs text-muted-foreground">
          Photo is {pixelDims.width} × {pixelDims.height} px
        </p>
      )}
    </div>
  )
}
