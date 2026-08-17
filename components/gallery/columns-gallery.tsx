"use client"

import Image from "next/image"
import Link from "next/link"
import { EmptyState } from "@/components/empty-state"
import { paintingAlt } from "@/lib/site"
import { aspectOf, Caption, hrefFor, TILE } from "./gallery-shared"
import type { Painting } from "@/lib/types"

interface ColumnsGalleryProps {
  paintings: (Painting & { home_section_slug?: string })[]
  sectionSlug: string
}

/** Production version of Layout C from the layout-preview tool: a uniform
 * CSS-columns masonry, every painting the same width. No JS measurement
 * needed — this is the same markup for SSR and after hydration. */
export function ColumnsGallery({ paintings, sectionSlug }: ColumnsGalleryProps) {
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

      <div className="columns-1 sm:columns-2 md:columns-3 gap-8">
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
                  sizes="(min-width: 768px) 33vw, (min-width: 640px) 50vw, 100vw"
                  quality={90}
                  className="object-cover"
                />
              )}
            </div>
            <Caption p={p} />
          </Link>
        ))}
      </div>
    </div>
  )
}
