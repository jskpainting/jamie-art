"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { layoutMosaic, parsePhysical } from "@/lib/mosaic-layout"
import { layoutPairs, PAIRS } from "@/lib/pairs-layout"
import { formatPrice } from "@/lib/utils"
import type { Painting, PaintingStatus } from "@/lib/types"

type LayoutKey = "pairs" | "mosaic" | "columns"

const layoutNotes: Record<LayoutKey, { title: string; body: string }> = {
  pairs: {
    title: "A · Two per row",
    body: "Max two paintings per row, each sized to its real dimensions so bigger canvases read bigger and nothing is cropped. Spacious and gallery-like; rows vary in height. Best when you want each piece to breathe.",
  },
  mosaic: {
    title: "B · Column mosaic (current)",
    body: "A fixed 4-column grid; large canvases span two columns. Densest and most structured — everything aligns to columns, no gaps. Best for browsing a lot of work at once.",
  },
  columns: {
    title: "C · Uniform columns",
    body: "A clean 3-column masonry, every painting the same width, height by true shape. The most orderly and predictable; size relevance comes only from height + the labels.",
  },
}

const TILE =
  "relative overflow-hidden bg-muted/40 ring-1 ring-foreground/[0.06] shadow-[0_2px_7px_rgba(20,18,14,0.16),0_14px_30px_-8px_rgba(20,18,14,0.26)] transition duration-200 group-hover:-translate-y-0.5 group-hover:shadow-[0_4px_10px_rgba(20,18,14,0.20),0_20px_40px_-10px_rgba(20,18,14,0.32)] group-hover:brightness-[1.02]"

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

function aspectOf(p: Painting): number {
  if (p.width && p.height && p.height > 0) return p.width / p.height
  const d = parsePhysical(p.dimensions)
  return d ? d[0] / d[1] : 4 / 3
}

function Tile({ p, w, h }: { p: Painting; w: number; h: number }) {
  return (
    <Link href={`/portfolio/abstracts/${p.slug}`} className="group block">
      <div className={TILE} style={{ width: w, height: h }}>
        {p.primary_image_url ? (
          <Image
            src={p.primary_image_url}
            alt={p.title}
            fill
            sizes="50vw"
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

// --- Layout A: max two per row, sized by real dimensions (shared framework) ---
function PairsLayout({ paintings, W }: { paintings: Painting[]; W: number }) {
  const layout = layoutPairs(
    paintings.map((p) => {
      const d = parsePhysical(p.dimensions)
      return {
        longSideInches: d ? Math.max(d[0], d[1]) : null,
        aspect: aspectOf(p),
      }
    }),
    W
  )
  const gap = PAIRS.gap[layout.bp]
  return (
    <div>
      {layout.rows.map((row, ri) => (
        <div
          key={ri}
          className="flex items-end justify-center"
          style={{
            columnGap: gap,
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
      ))}
    </div>
  )
}

// --- Layout B: column mosaic (the current live layout) -----------------------
function MosaicLayout({ paintings, W }: { paintings: Painting[]; W: number }) {
  const layout = useMemo(
    () =>
      layoutMosaic(
        paintings.map((p) => ({
          physical: parsePhysical(p.dimensions),
          aspect: aspectOf(p),
        })),
        W
      ),
    [paintings, W]
  )
  return (
    <div className="relative" style={{ height: layout.height }}>
      {layout.tiles.map((tile) => {
        const p = paintings[tile.index]
        return (
          <div
            key={p.id}
            className="absolute"
            style={{ left: Math.round(tile.x), top: Math.round(tile.y), width: Math.round(tile.w) }}
          >
            <Tile p={p} w={Math.round(tile.w)} h={Math.round(tile.h)} />
          </div>
        )
      })}
    </div>
  )
}

// --- Layout C: uniform 3-column masonry --------------------------------------
function ColumnsLayout({ paintings }: { paintings: Painting[] }) {
  return (
    <div className="columns-2 md:columns-3 gap-8">
      {paintings.map((p) => (
        <Link
          key={p.id}
          href={`/portfolio/abstracts/${p.slug}`}
          className="group mb-8 block break-inside-avoid"
        >
          <div className={TILE} style={{ aspectRatio: String(aspectOf(p)) }}>
            {p.primary_image_url && (
              <Image
                src={p.primary_image_url}
                alt={p.title}
                fill
                sizes="(min-width: 768px) 33vw, 50vw"
                quality={90}
                className="object-cover"
              />
            )}
          </div>
          <Caption p={p} />
        </Link>
      ))}
    </div>
  )
}

interface LayoutPreviewClientProps {
  paintings: Painting[]
}

export function LayoutPreviewClient({ paintings }: LayoutPreviewClientProps) {
  const [tab, setTab] = useState<LayoutKey>("pairs")
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

  const notes = layoutNotes[tab]

  return (
    <div className="space-y-6">
      <Tabs value={tab} onValueChange={(v) => setTab(v as LayoutKey)}>
        <TabsList>
          <TabsTrigger value="pairs">A · Two per row</TabsTrigger>
          <TabsTrigger value="mosaic">B · Mosaic</TabsTrigger>
          <TabsTrigger value="columns">C · Columns</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-xs uppercase tracking-[0.2em] font-medium text-muted-foreground mb-2">
          Notes — {notes.title}
        </p>
        <p className="text-sm leading-relaxed text-card-foreground">{notes.body}</p>
      </div>

      <div ref={containerRef} className="w-full">
        {tab === "columns" ? (
          <ColumnsLayout paintings={paintings} />
        ) : width && width > 0 ? (
          tab === "pairs" ? (
            <PairsLayout paintings={paintings} W={width} />
          ) : (
            <MosaicLayout paintings={paintings} W={width} />
          )
        ) : (
          <ColumnsLayout paintings={paintings} />
        )}
      </div>
    </div>
  )
}
