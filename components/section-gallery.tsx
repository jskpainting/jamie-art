"use client"

import Link from "next/link"
import { JustifiedRows } from "@/components/layouts/justified-rows"
import { EmptyState } from "@/components/empty-state"
import { ImageWithSkeleton } from "@/components/image-with-skeleton"
import type { Painting } from "@/lib/types"
import { cn } from "@/lib/utils"

// Paintings don't store intrinsic pixel dimensions — default to a near-square
// ratio that works well for oils/acrylics. Replace with per-painting values
// when/if width_px + height_px columns are added to the paintings table.
const DEFAULT_ASPECT = 4 / 3

const SOLD_LABELS: Partial<Record<string, string>> = {
  sold: "Sold",
  nfs: "Not for sale",
  reserved: "Reserved",
}

interface SectionGalleryProps {
  paintings: Painting[]
  sectionSlug: string
}

export function SectionGallery({ paintings, sectionSlug }: SectionGalleryProps) {
  if (paintings.length === 0) {
    return (
      <EmptyState
        title="No paintings yet"
        description="Check back soon — new work is on the way."
      />
    )
  }

  return (
    <JustifiedRows
      items={paintings}
      getAspect={() => DEFAULT_ASPECT}
      getKey={(p) => p.id}
      rowHeights={{ desktop: 320, tablet: 240, mobile: 180 }}
      renderItem={(painting) => (
        <Link
          href={`/portfolio/${sectionSlug}/${painting.slug}`}
          className="group relative block h-full w-full overflow-hidden bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label={painting.title}
        >
          {painting.primary_image_url ? (
            <ImageWithSkeleton
              src={painting.primary_image_url}
              alt={painting.title}
              fill
              sizes="(min-width: 1024px) 33vw, 50vw"
              className={cn(
                "object-cover transition-transform duration-300",
                "motion-safe:group-hover:scale-[1.01]"
              )}
            />
          ) : (
            <div className="h-full w-full bg-muted" />
          )}

          {/* Status badge — always visible, top-left */}
          {painting.status !== "available" && SOLD_LABELS[painting.status] && (
            <span className="absolute top-2 left-2 z-10 text-xs px-2 py-0.5 font-medium bg-background/90 text-foreground backdrop-blur-sm">
              {SOLD_LABELS[painting.status]}
            </span>
          )}
        </Link>
      )}
    />
  )
}
