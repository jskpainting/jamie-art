"use client"

import { useState } from "react"
import { PaintingCard } from "@/components/painting-card"
import { PaintingLightbox } from "@/components/painting-lightbox"
import { EmptyState } from "@/components/empty-state"
import type { Painting } from "@/lib/types"

interface SectionGalleryProps {
  paintings: Painting[]
  sectionSlug: string
}

export function SectionGallery({ paintings, sectionSlug }: SectionGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  if (paintings.length === 0) {
    return (
      <EmptyState
        title="No paintings yet"
        description="Check back soon — new work is on the way."
      />
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {paintings.map((painting, i) => (
          <PaintingCard
            key={painting.id}
            painting={painting}
            onClick={() => setLightboxIndex(i)}
          />
        ))}
      </div>

      {lightboxIndex !== null && (
        <PaintingLightbox
          paintings={paintings}
          initialIndex={lightboxIndex}
          sectionSlug={sectionSlug}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  )
}
