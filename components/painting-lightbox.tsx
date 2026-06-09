"use client"

import { useEffect, useState, useCallback } from "react"
import Image from "next/image"
import Link from "next/link"
import { ChevronLeft, ChevronRight, X, ExternalLink } from "lucide-react"
import type { Painting, PaintingStatus } from "@/lib/types"
import { formatPrice, cn } from "@/lib/utils"

const statusLabel: Record<PaintingStatus, string> = {
  available: "Available",
  sold: "Sold",
  nfs: "Not for sale",
  reserved: "Reserved",
}

const statusStyle: Record<PaintingStatus, string> = {
  available:
    "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  sold: "bg-muted text-muted-foreground",
  nfs: "bg-muted text-muted-foreground",
  reserved: "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
}

interface PaintingLightboxProps {
  paintings: Painting[]
  initialIndex: number
  sectionSlug: string
  onClose: () => void
}

export function PaintingLightbox({
  paintings,
  initialIndex,
  sectionSlug,
  onClose,
}: PaintingLightboxProps) {
  const [index, setIndex] = useState(initialIndex)
  const painting = paintings[index]

  const prev = useCallback(() => {
    setIndex((i) => (i === 0 ? paintings.length - 1 : i - 1))
  }, [paintings.length])

  const next = useCallback(() => {
    setIndex((i) => (i === paintings.length - 1 ? 0 : i + 1))
  }, [paintings.length])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowLeft") prev()
      if (e.key === "ArrowRight") next()
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [onClose, prev, next])

  // Prevent body scroll while lightbox is open
  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = "" }
  }, [])

  if (!painting) return null

  const priceDisplay =
    painting.status === "available" && painting.price_cents
      ? `Available — ${formatPrice(painting.price_cents)}`
      : statusLabel[painting.status]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Lightbox: ${painting.title}`}
    >
      {/* Panel — stop propagation so clicks inside don't close */}
      <div
        className="relative flex flex-col bg-background w-full h-full md:h-auto md:max-h-[85vh] md:max-w-[90vw] md:rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 rounded-full bg-background/80 backdrop-blur-sm p-1.5 text-foreground hover:bg-muted transition-colors"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Image */}
        <div className="flex-1 flex items-center justify-center bg-muted/20 min-h-0">
          {painting.primary_image_url ? (
            <div className="relative w-full h-full md:max-h-[60vh] flex items-center justify-center p-4">
              <Image
                src={painting.primary_image_url}
                alt={painting.title}
                width={1200}
                height={900}
                className="object-contain max-h-[55vh] md:max-h-[58vh] w-auto mx-auto"
                sizes="90vw"
                priority
              />
            </div>
          ) : (
            <div className="w-full aspect-[4/3] bg-muted" />
          )}
        </div>

        {/* Metadata bar */}
        <div className="px-5 py-4 flex items-center justify-between gap-4 border-t border-border bg-background">
          <div className="min-w-0">
            <p className="font-serif text-base font-light tracking-tight truncate">
              {painting.title}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className={cn(
                  "text-xs px-2 py-0.5 rounded-full font-medium",
                  statusStyle[painting.status]
                )}
              >
                {priceDisplay}
              </span>
            </div>
          </div>

          <Link
            href={`/portfolio/${sectionSlug}/${painting.slug}`}
            className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            onClick={onClose}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Full details
          </Link>
        </div>

        {/* Navigation arrows */}
        {paintings.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-background/80 backdrop-blur-sm p-2 text-foreground hover:bg-muted transition-colors shadow"
              aria-label="Previous painting"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={next}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-background/80 backdrop-blur-sm p-2 text-foreground hover:bg-muted transition-colors shadow"
              aria-label="Next painting"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
