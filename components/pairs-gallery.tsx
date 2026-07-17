"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { layoutPairs, PAIRS } from "@/lib/pairs-layout"
import { parsePhysical } from "@/lib/mosaic-layout"
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
  if (p.status === "available")
    return p.price_cents ? formatPrice(p.price_cents) : "Available"
  return statusWord[p.status]
}

function dimsLabel(dimensions: string | null): string | null {
  const d = parsePhysical(dimensions)
  return d ? `${d[0]} × ${d[1]} in` : null
}

function aspectOf(p: Painting): number {
  if (p.width && p.height && p.height > 0) return p.width / p.height
  const d = parsePhysical(p.dimensions)
  return d ? d[0] / d[1] : 4 / 3
}

const TILE =
  "relative overflow-hidden bg-muted/40 ring-1 ring-foreground/[0.06] shadow-[0_2px_7px_rgba(20,18,14,0.16),0_14px_30px_-8px_rgba(20,18,14,0.26)] transition duration-200 group-hover:-translate-y-0.5 group-hover:shadow-[0_4px_10px_rgba(20,18,14,0.20),0_20px_40px_-10px_rgba(20,18,14,0.32)] group-hover:brightness-[1.02] group-focus-visible:ring-ring"

interface PairsGalleryProps {
  paintings: Painting[]
  sectionSlug: string
}

export function PairsGallery({ paintings, sectionSlug }: PairsGalleryProps) {
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
      paintings.map((p) => {
        const d = parsePhysical(p.dimensions)
        return {
          longSideInches: d ? Math.max(d[0], d[1]) : null,
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

  function Caption({ p, w }: { p: Painting; w?: number }) {
    const meta = [dimsLabel(p.dimensions), priceOrStatus(p)]
      .filter(Boolean)
      .join(" · ")
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

  function Tile({ p, w, h }: { p: Painting; w: number; h: number }) {
    return (
      <Link
        href={`/portfolio/${sectionSlug}/${p.slug}`}
        className="group block focus-visible:outline-none"
        aria-label={p.title}
      >
        <div className={TILE} style={{ width: w, height: h }}>
          {p.primary_image_url ? (
            <Image
              src={p.primary_image_url}
              alt={p.title}
              fill
              sizes={`${Math.max(20, Math.round((w / (width ?? 1200)) * 100))}vw`}
              quality={90}
              className="object-cover"
            />
          ) : (
            <div className="h-full w-full bg-muted" />
          )}
        </div>
        <Caption p={p} w={w} />
      </Link>
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
              style={{
                columnGap: gapPx,
                marginBottom: row.solo ? PAIRS.soloRowGap : PAIRS.rowGap,
              }}
            >
              {row.tiles.map((t) => (
                <div key={paintings[t.index].id} className="shrink-0">
                  <Tile
                    p={paintings[t.index]}
                    w={Math.round(t.w)}
                    h={Math.round(t.h)}
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
                href={`/portfolio/${sectionSlug}/${p.slug}`}
                className="group mb-10 block break-inside-avoid"
                aria-label={p.title}
              >
                <div className={TILE} style={{ aspectRatio: String(aspectOf(p)) }}>
                  {p.primary_image_url && (
                    <Image
                      src={p.primary_image_url}
                      alt={p.title}
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
