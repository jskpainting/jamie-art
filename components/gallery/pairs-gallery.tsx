"use client"

import { useMemo } from "react"
import Link from "next/link"
import Image from "next/image"
import { layoutPairs, PAIRS } from "@/lib/pairs-layout"
import { parsePhysical } from "@/lib/mosaic-layout"
import { EmptyState } from "@/components/empty-state"
import { paintingAlt } from "@/lib/site"
import { aspectOf, Caption, hrefFor, Tile, TILE, useContainerWidth } from "./gallery-shared"
import type { Painting } from "@/lib/types"

interface PairsGalleryProps {
  paintings: (Painting & { home_section_slug?: string })[]
  sectionSlug: string
}

export function PairsGallery({ paintings, sectionSlug }: PairsGalleryProps) {
  const { containerRef, width } = useContainerWidth()

  const inputs = useMemo(
    () =>
      paintings.map((p) => {
        const d = parsePhysical(p.dimensions)
        return {
          physHeightInches: d ? d[1] : null,
          aspect: aspectOf(p),
        }
      }),
    [paintings]
  )

  const layout = useMemo(
    () => (width && width > 0 ? layoutPairs(inputs, width) : null),
    [inputs, width]
  )

  if (paintings.length === 0) {
    return (
      <EmptyState
        title="No paintings yet"
        description="Check back soon — new work is on the way."
      />
    )
  }

  const gapPx = layout ? PAIRS.gap[layout.bp] : PAIRS.gap.desktop

  return (
    <div>
      <p className="mb-8 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        Shown to relative scale
      </p>

      <div ref={containerRef} className="w-full">
        {layout ? (
          layout.rows.map((row, ri) => (
            <div
              key={ri}
              className="flex items-end justify-center"
              style={{ columnGap: gapPx, marginBottom: PAIRS.rowGap }}
            >
              {row.tiles.map((t) => (
                <div key={paintings[t.index].id} className="shrink-0">
                  <Tile
                    p={paintings[t.index]}
                    w={Math.round(t.w)}
                    h={Math.round(t.h)}
                    href={hrefFor(paintings[t.index], sectionSlug)}
                    containerWidth={width}
                  />
                </div>
              ))}
            </div>
          ))
        ) : (
          // SSR / pre-measure fallback: a clean CSS-columns masonry so the wall is
          // always a structured grid (and crawlable) before the layout measures.
          <div className="columns-1 sm:columns-2 gap-10">
            {paintings.map((p) => (
              <Link
                key={p.id}
                href={hrefFor(p, sectionSlug)}
                className="group mb-10 block break-inside-avoid"
                aria-label={p.title}
              >
                <div className={TILE} style={{ aspectRatio: String(aspectOf(p)) }}>
                  {p.primary_image_url && (
                    <Image
                      src={p.primary_image_url}
                      alt={paintingAlt(p.title)}
                      fill
                      sizes="(max-width: 640px) 90vw, 45vw"
                      quality={90}
                      className="object-cover"
                    />
                  )}
                </div>
                <Caption p={p} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
