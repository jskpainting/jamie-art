"use client"

import { PairsGallery } from "./pairs-gallery"
import { MosaicGallery } from "./mosaic-gallery"
import { ColumnsGallery } from "./columns-gallery"
import type { GalleryLayout, Painting } from "@/lib/types"

interface SectionGalleryProps {
  paintings: (Painting & { home_section_slug?: string })[]
  sectionSlug: string
  layout: GalleryLayout
}

/** Picks the live gallery layout. Default 'pairs' keeps today's site pixel-identical. */
export function SectionGallery({ paintings, sectionSlug, layout }: SectionGalleryProps) {
  if (layout === "mosaic") {
    return <MosaicGallery paintings={paintings} sectionSlug={sectionSlug} />
  }
  if (layout === "columns") {
    return <ColumnsGallery paintings={paintings} sectionSlug={sectionSlug} />
  }
  return <PairsGallery paintings={paintings} sectionSlug={sectionSlug} />
}
