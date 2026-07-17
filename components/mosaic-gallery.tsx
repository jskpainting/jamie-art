"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { layoutMosaic, parsePhysical } from "@/lib/mosaic-layout"
import { EmptyState } from "@/components/empty-state"
import { formatPrice } from "@/lib/utils"
import type { Painting, PaintingStatus } from "@/lib/types"

const statusWord: Record<PaintingStatus, string> = {
  available: "Available",
  sold: "Sold",
  nfs: "Not for sale",
  reserved: "Reserved",
}

function priceOrStatus(p: Painting): string {
  if (p.status === "available") {
    return p.price_cents ? formatPrice(p.price_cents) : "Available"
  }
  return statusWord[p.status]
}

function dimsLabel(dimensions: string | null): string | null {
  const d = parsePhysical(dimensions)
  return d ? `${d[0]} × ${d[1]} in` : null
}

interface MosaicGalleryProps {
  paintings: Painting[]
  sectionSlug: string
}

export function MosaicGallery({ paintings, sectionSlug }: MosaicGalleryProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState<number | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    let raf = 0
    const apply = () => {
      const w = el.getBoundingClientRect().width
      if (w > 0) {
        setWidth(w)
        return true
      }
      return false
    }
    const pump = () => {
      if (!apply()) raf = requestAnimationFrame(pump)
    }
    pump()
    const observer = new ResizeObserver(apply)
    observer.observe(el)
    window.addEventListener("resize", apply)
    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
      window.removeEventListener("resize", apply)
    }
  }, [])

  const inputs = useMemo(
    () =>
      paintings.map((p) => ({
        physical: parsePhysical(p.dimensions),
        aspect: p.width && p.height && p.height > 0 ? p.width / p.height : 4 / 3,
      })),
    [paintings]
  )

  const layout = useMemo(
    () => (width && width > 0 ? layoutMosaic(inputs, width) : null),
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

  function Caption({ p, w }: { p: Painting; w?: number }) {
    const dims = dimsLabel(p.dimensions)
    const meta = [dims, priceOrStatus(p)].filter(Boolean).join(" · ")
    return (
      <div className="mt-3" style={w ? { maxWidth: Math.round(w) } : undefined}>
        <p className="font-serif font-semibold text-[15px] leading-tight text-foreground truncate">
          {p.title}
          {p.year ? `, ${p.year}` : ""}
        </p>
        <p className="mt-1 text-xs tracking-[0.01em] text-muted-foreground truncate">
          {meta}
        </p>
      </div>
    )
  }

  return (
    <div>
      <p className="mb-8 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        Shown to relative scale
      </p>

      <div
        ref={containerRef}
        className="relative w-full"
        style={layout ? { height: layout.height } : undefined}
      >
        {layout
          ? layout.tiles.map((tile, i) => {
              const p = paintings[tile.index]
              return (
                <div
                  key={p.id}
                  className="mosaic-tile absolute"
                  style={{
                    left: Math.round(tile.x),
                    top: Math.round(tile.y),
                    width: Math.round(tile.w),
                    animationDelay: `${Math.min(i, 12) * 40}ms`,
                  }}
                >
                  <Link
                    href={`/portfolio/${sectionSlug}/${p.slug}`}
                    className="group block focus-visible:outline-none"
                    aria-label={p.title}
                  >
                    <div
                      className="relative overflow-hidden bg-muted/40 ring-1 ring-foreground/[0.06] shadow-[0_2px_7px_rgba(20,18,14,0.16),0_14px_30px_-8px_rgba(20,18,14,0.26)] transition duration-200 group-hover:-translate-y-0.5 group-hover:shadow-[0_4px_10px_rgba(20,18,14,0.20),0_20px_40px_-10px_rgba(20,18,14,0.32)] group-hover:brightness-[1.02] group-focus-visible:ring-ring"
                      style={{
                        width: Math.round(tile.w),
                        height: Math.round(tile.h),
                      }}
                    >
                      {p.primary_image_url ? (
                        <Image
                          src={p.primary_image_url}
                          alt={p.title}
                          fill
                          sizes={`${Math.max(10, Math.round((tile.w / (width ?? 1200)) * 100))}vw`}
                          quality={90}
                          className="object-cover"
                        />
                      ) : (
                        <div className="h-full w-full bg-muted" />
                      )}
                    </div>
                    <Caption p={p} w={tile.w} />
                  </Link>
                </div>
              )
            })
          : // SSR / pre-measure fallback: a pure CSS-columns masonry so the wall
            // is always a structured multi-column grid (never a lonely single
            // column) even before the sized mosaic computes or if JS is off.
            <div className="columns-2 md:columns-3 lg:columns-4 gap-8">
              {paintings.map((p) => {
                const aspect =
                  p.width && p.height && p.height > 0 ? p.width / p.height : 4 / 3
                return (
                  <Link
                    key={p.id}
                    href={`/portfolio/${sectionSlug}/${p.slug}`}
                    className="group mb-8 block break-inside-avoid"
                    aria-label={p.title}
                  >
                    <div
                      className="relative overflow-hidden bg-muted/40 ring-1 ring-foreground/[0.06] shadow-[0_2px_7px_rgba(20,18,14,0.16),0_14px_30px_-8px_rgba(20,18,14,0.26)] transition duration-200 group-hover:-translate-y-0.5 group-hover:shadow-[0_4px_10px_rgba(20,18,14,0.20),0_20px_40px_-10px_rgba(20,18,14,0.32)] group-hover:brightness-[1.02]"
                      style={{ aspectRatio: String(aspect) }}
                    >
                      {p.primary_image_url && (
                        <Image
                          src={p.primary_image_url}
                          alt={p.title}
                          fill
                          sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
                          quality={90}
                          className="object-cover"
                        />
                      )}
                    </div>
                    <Caption p={p} />
                  </Link>
                )
              })}
            </div>}
      </div>
    </div>
  )
}
