"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { parsePhysical } from "@/lib/mosaic-layout"
import { formatPrice } from "@/lib/utils"
import { paintingAlt } from "@/lib/site"
import type { Painting, PaintingStatus } from "@/lib/types"

/** Shared visual treatment for every gallery tile across pairs/mosaic/columns. */
export const TILE =
  "relative overflow-hidden bg-muted/40 ring-1 ring-foreground/[0.06] shadow-[0_2px_7px_rgba(20,18,14,0.16),0_14px_30px_-8px_rgba(20,18,14,0.26)] transition duration-200 group-hover:-translate-y-0.5 group-hover:shadow-[0_4px_10px_rgba(20,18,14,0.20),0_20px_40px_-10px_rgba(20,18,14,0.32)] group-hover:brightness-[1.02] group-focus-visible:ring-ring"

const statusWord: Record<PaintingStatus, string> = {
  available: "Available",
  sold: "Sold",
  nfs: "Not for sale",
  reserved: "Reserved",
}

export function priceOrStatus(p: Painting): string {
  if (p.status === "available")
    return p.price_cents ? formatPrice(p.price_cents) : "Available"
  return statusWord[p.status]
}

export function dimsLabel(dimensions: string | null): string | null {
  const d = parsePhysical(dimensions)
  return d ? `${d[0]} × ${d[1]} in` : null
}

export function aspectOf(p: Painting): number {
  if (p.width && p.height && p.height > 0) return p.width / p.height
  const d = parsePhysical(p.dimensions)
  return d ? d[0] / d[1] : 4 / 3
}

// A painting shown in a gallery that isn't its home links to its canonical
// home-section URL (the detail page resolves by home section + slug).
export function hrefFor(
  p: Painting & { home_section_slug?: string },
  sectionSlug: string
): string {
  return `/portfolio/${p.home_section_slug || sectionSlug}/${p.slug}`
}

export function Caption({ p, w }: { p: Painting; w?: number }) {
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

interface TileProps {
  p: Painting & { home_section_slug?: string }
  w: number
  h: number
  href: string
  /** Measured container width, used to size the `sizes` attribute. */
  containerWidth?: number | null
}

export function Tile({ p, w, h, href, containerWidth }: TileProps) {
  return (
    <Link href={href} className="group block focus-visible:outline-none" aria-label={p.title}>
      <div className={TILE} style={{ width: w, height: h }}>
        {p.primary_image_url ? (
          <Image
            src={p.primary_image_url}
            alt={paintingAlt(p.title)}
            fill
            sizes={`${Math.max(20, Math.round((w / (containerWidth ?? 1200)) * 100))}vw`}
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

/** Measures a container's width via ResizeObserver, pumping via rAF until the
 * element has a real layout box (handles the first-paint-before-layout race). */
export function useContainerWidth() {
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

  return { containerRef, width }
}
