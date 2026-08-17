"use client"

import { useMemo } from "react"
import Link from "next/link"
import Image from "next/image"
import { layoutMosaic, parsePhysical } from "@/lib/mosaic-layout"
import { EmptyState } from "@/components/empty-state"
import { paintingAlt } from "@/lib/site"
import { aspectOf, Caption, hrefFor, Tile, TILE, useContainerWidth } from "./gallery-shared"
import type { Painting } from "@/lib/types"

interface MosaicGalleryProps {
  paintings: (Painting & { home_section_slug?: string })[]
  sectionSlug: string
}

/** Production version of Layout B from the layout-preview tool: a fixed
 * column mosaic where large canvases span two columns. */
export function MosaicGallery({ paintings, sectionSlug }: MosaicGalleryProps) {
  const { containerRef, width } = useContainerWidth()

  const items = useMemo(
    () =>
      paintings.map((p) => ({
        physical: parsePhysical(p.dimensions),
        aspect: aspectOf(p),
      })),
    [paintings]
  )

  const layout = useMemo(
    () => (width && width > 0 ? layoutMosaic(items, width) : null),
    [items, width]
  )

  if (paintings.length === 0) {
    return (
      <EmptyState
        title="No paintings yet"
        description="Check back soon — new work is on the way."
      />
    )
  }

  return (
    <div>
      <p className="mb-8 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        Shown to relative scale
      </p>

      <div ref={containerRef} className="w-full">
        {layout ? (
          <div className="relative" style={{ height: layout.height }}>
            {layout.tiles.map((tile) => {
              const p = paintings[tile.index]
              return (
                <div
                  key={p.id}
                  className="absolute"
                  style={{ left: Math.round(tile.x), top: Math.round(tile.y), width: Math.round(tile.w) }}
                >
                  <Tile
                    p={p}
                    w={Math.round(tile.w)}
                    h={Math.round(tile.h)}
                    href={hrefFor(p, sectionSlug)}
                    containerWidth={width}
                  />
                </div>
              )
            })}
          </div>
        ) : (
          // SSR / pre-measure fallback: a clean CSS-columns masonry.
          <div className="columns-2 sm:columns-3 md:columns-4 gap-8">
            {paintings.map((p) => (
              <Link
                key={p.id}
                href={hrefFor(p, sectionSlug)}
                className="group mb-8 block break-inside-avoid"
                aria-label={p.title}
              >
                <div className={TILE} style={{ aspectRatio: String(aspectOf(p)) }}>
                  {p.primary_image_url && (
                    <Image
                      src={p.primary_image_url}
                      alt={paintingAlt(p.title)}
                      fill
                      sizes="(min-width: 768px) 25vw, 33vw"
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
