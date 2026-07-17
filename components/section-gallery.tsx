"use client"

import Link from "next/link"
import { JustifiedRows } from "@/components/layouts/justified-rows"
import { EmptyState } from "@/components/empty-state"
import { ImageWithSkeleton } from "@/components/image-with-skeleton"
import type { Painting } from "@/lib/types"
import { cn } from "@/lib/utils"

// Each painting stores its true pixel dimensions (width/height), so the gallery
// packs every piece at its real aspect ratio — nothing is cropped. Fall back to
// a gentle 4:3 only if a painting is somehow missing dimensions, and clamp the
// extremes so one very tall/wide canvas can't distort a whole row.
const FALLBACK_ASPECT = 4 / 3
const MIN_ASPECT = 0.45 // tallest portrait we allow before clamping
const MAX_ASPECT = 3.2 // widest panorama we allow before clamping

function aspectOf(p: Painting): number {
  const raw =
    p.width && p.height && p.height > 0 ? p.width / p.height : FALLBACK_ASPECT
  return Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, raw))
}

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
      getAspect={aspectOf}
      getKey={(p) => p.id}
      rowHeights={{ desktop: 340, tablet: 260, mobile: 200 }}
      renderItem={(painting) => (
        <Link
          href={`/portfolio/${sectionSlug}/${painting.slug}`}
          className="group relative block h-full w-full overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label={painting.title}
        >
          {painting.primary_image_url ? (
            <ImageWithSkeleton
              src={painting.primary_image_url}
              alt={painting.title}
              fill
              sizes="(max-width: 768px) 50vw, 33vw"
              quality={90}
              className={cn(
                "object-contain transition-transform duration-300",
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
