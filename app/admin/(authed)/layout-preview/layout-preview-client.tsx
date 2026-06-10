"use client"

import { useCallback, useEffect, useState } from "react"
import Image from "next/image"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { ChevronLeft, ChevronRight, X } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MasonryGrid } from "@/components/layouts/masonry-grid"
import { JustifiedRows } from "@/components/layouts/justified-rows"
import { AspectGrid } from "@/components/layouts/aspect-grid"
import type { SampleImage } from "@/lib/layout-samples"

type LayoutKey = "masonry" | "justified" | "aspect-grid"

const layoutNotes: Record<LayoutKey, { title: string; body: string }> = {
  masonry: {
    title: "Masonry",
    body: "Editorial. Reads like Pinterest. Every image gets its natural proportions and nothing is cropped. Trade-off: column heights can desync and the eye flow is non-linear — viewers scan down columns rather than across rows, so ordering is only loosely preserved.",
  },
  justified: {
    title: "Justified Rows",
    body: "Magazine-grade. Every row aligns to a clean baseline and the container edge is always flush, which reads as the most deliberate and gallery-like. Trade-off: images are scaled up or down to fit each row's height — small images get blown up past their comfortable size, and an extreme aspect ratio can dominate or shrink its whole row.",
  },
  "aspect-grid": {
    title: "Aspect Ratio Grid",
    body: "Most structured. Predictable left-to-right scan path with a fixed column rhythm, and every image keeps its intrinsic aspect ratio uncropped. Trade-off: big aspect mismatches leave visual weight inconsistent row-to-row — a tall portrait next to a wide landscape creates uneven whitespace.",
  },
}

interface LayoutPreviewClientProps {
  images: SampleImage[]
}

export function LayoutPreviewClient({ images }: LayoutPreviewClientProps) {
  const [tab, setTab] = useState<LayoutKey>("masonry")
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const reducedMotion = useReducedMotion()

  const notes = layoutNotes[tab]

  return (
    <div className="space-y-6">
      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as LayoutKey)}
      >
        <TabsList>
          <TabsTrigger value="masonry">Masonry</TabsTrigger>
          <TabsTrigger value="justified">Justified</TabsTrigger>
          <TabsTrigger value="aspect-grid">Aspect Grid</TabsTrigger>
        </TabsList>
      </Tabs>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reducedMotion ? { opacity: 1 } : { opacity: 0, y: -8 }}
          transition={{ duration: reducedMotion ? 0 : 0.25, ease: "easeOut" }}
        >
          {tab === "masonry" && (
            <MasonryGrid images={images} onImageClick={setLightboxIndex} />
          )}
          {tab === "justified" && (
            <JustifiedRows
              items={images}
              getAspect={(img) => img.width / img.height}
              getKey={(img) => img.src}
              renderItem={(image, index) => (
                <button
                  type="button"
                  onClick={() => setLightboxIndex(index)}
                  className="group block h-full w-full cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  aria-label={`View ${image.alt}`}
                >
                  <span className="block h-full w-full overflow-hidden shadow-sm transition-[transform,box-shadow] duration-200 motion-safe:group-hover:scale-[1.02] group-hover:shadow-lg">
                    <Image
                      src={image.src}
                      alt={image.alt}
                      width={image.width}
                      height={image.height}
                      sizes="(min-width: 1024px) 33vw, 50vw"
                      className="h-full w-full object-cover"
                    />
                  </span>
                </button>
              )}
            />
          )}
          {tab === "aspect-grid" && (
            <AspectGrid images={images} onImageClick={setLightboxIndex} />
          )}

          <div className="mt-8 rounded-2xl border border-border bg-card p-5">
            <p className="text-xs uppercase tracking-[0.2em] font-medium text-muted-foreground mb-2">
              Notes — {notes.title}
            </p>
            <p className="text-sm leading-relaxed text-card-foreground">
              {notes.body}
            </p>
          </div>
        </motion.div>
      </AnimatePresence>

      {lightboxIndex !== null && (
        <SampleLightbox
          images={images}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  )
}

interface SampleLightboxProps {
  images: SampleImage[]
  initialIndex: number
  onClose: () => void
}

// Minimal lightbox for raw image URLs. components/painting-lightbox.tsx is
// hard-wired to Painting records (status, price, detail links), so this dev
// tool inlines its own — same interaction model: esc / arrows / backdrop.
function SampleLightbox({ images, initialIndex, onClose }: SampleLightboxProps) {
  const [index, setIndex] = useState(initialIndex)
  const image = images[index]

  const prev = useCallback(() => {
    setIndex((i) => (i === 0 ? images.length - 1 : i - 1))
  }, [images.length])

  const next = useCallback(() => {
    setIndex((i) => (i === images.length - 1 ? 0 : i + 1))
  }, [images.length])

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
    return () => {
      document.body.style.overflow = ""
    }
  }, [])

  if (!image) return null

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/85 backdrop-blur-sm motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Lightbox: ${image.alt}`}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 rounded-full bg-background/80 backdrop-blur-sm p-2 text-foreground hover:bg-muted transition-colors"
        aria-label="Close"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Image area — full bleed, never cropped */}
      <div
        className="flex-1 flex items-center justify-center p-4 md:p-10 min-h-0"
        onClick={(e) => {
          // Only close when the backdrop itself is clicked, not the image
          if (e.target === e.currentTarget) onClose()
        }}
      >
        <Image
          src={image.src}
          alt={image.alt}
          width={image.width}
          height={image.height}
          sizes="100vw"
          className="max-h-full w-auto max-w-full object-contain shadow-2xl"
          priority
        />
      </div>

      {/* Caption bar */}
      <div
        className="shrink-0 px-6 pb-5 flex items-center justify-center gap-3 text-white/90"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-serif text-sm font-light tracking-tight">
          {image.alt}
        </p>
        <span className="text-xs text-white/50 tabular-nums">
          {index + 1} / {images.length}
        </span>
      </div>

      {images.length > 1 && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation()
              prev()
            }}
            className="absolute left-3 md:left-5 top-1/2 -translate-y-1/2 rounded-full bg-background/80 backdrop-blur-sm p-2 text-foreground hover:bg-muted transition-colors shadow"
            aria-label="Previous image"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              next()
            }}
            className="absolute right-3 md:right-5 top-1/2 -translate-y-1/2 rounded-full bg-background/80 backdrop-blur-sm p-2 text-foreground hover:bg-muted transition-colors shadow"
            aria-label="Next image"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  )
}
