"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { ChevronLeft } from "lucide-react"
import { InquireDialog } from "@/components/inquire-dialog"
import { PrintRequestDialog } from "@/components/print-request-dialog"
import { ZoomOverlay } from "@/components/zoom-overlay"
import { formatPrice, cn } from "@/lib/utils"
import type { PaintingWithImages, PaintingStatus, Settings } from "@/lib/types"

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
  reserved:
    "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
}

interface PaintingDetailViewProps {
  painting: PaintingWithImages
  sectionSlug: string
  sectionTitle: string
  settings: Settings | null
  paintingUrl: string
}

export function PaintingDetailView({
  painting,
  sectionSlug,
  sectionTitle,
  settings,
  paintingUrl,
}: PaintingDetailViewProps) {
  const [zoomOpen, setZoomOpen] = useState(false)

  const priceDisplay =
    painting.status === "available" && painting.price_cents
      ? formatPrice(painting.price_cents)
      : null

  const additionalImages = painting.painting_images ?? []

  return (
    <div className="max-w-7xl mx-auto px-6 md:px-10 py-10 md:py-16">
      {/* Breadcrumb */}
      <Link
        href={`/portfolio/${sectionSlug}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
      >
        <ChevronLeft className="h-4 w-4" />
        {sectionTitle}
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">
        {/* Primary image */}
        <div className="space-y-4">
          <div className="flex items-start justify-center">
            {painting.primary_image_url ? (
              <>
                <Image
                  src={painting.primary_image_url}
                  alt={painting.title}
                  width={0}
                  height={0}
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="max-h-[70vh] md:max-h-[80vh] max-w-full w-auto h-auto object-contain cursor-zoom-in"
                  style={{ width: "auto", height: "auto" }}
                  priority
                  onClick={() => setZoomOpen(true)}
                />
                <ZoomOverlay
                  src={painting.primary_image_url}
                  alt={painting.title}
                  open={zoomOpen}
                  onClose={() => setZoomOpen(false)}
                />
              </>
            ) : (
              <div className="w-full aspect-[4/3] bg-muted" />
            )}
          </div>

          {/* Additional images */}
          {additionalImages.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {additionalImages.map((img) => (
                <div
                  key={img.id}
                  className="relative aspect-square overflow-hidden bg-muted"
                >
                  <Image
                    src={img.url}
                    alt={img.alt ?? painting.title}
                    fill
                    sizes="25vw"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Metadata */}
        <div className="flex flex-col">
          <h1 className="font-serif text-3xl md:text-4xl font-light tracking-tight mb-3">
            {painting.title}
          </h1>

          {/* Status badge */}
          <div className="flex items-center gap-3 mb-6">
            <span
              className={cn(
                "text-xs px-2.5 py-1 rounded-full font-medium",
                statusStyle[painting.status]
              )}
            >
              {statusLabel[painting.status]}
            </span>
            {priceDisplay && (
              <span className="text-lg font-medium">{priceDisplay}</span>
            )}
          </div>

          {/* Details */}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm mb-8">
            {painting.year && (
              <>
                <dt className="text-muted-foreground">Year</dt>
                <dd>{painting.year}</dd>
              </>
            )}
            {painting.medium && (
              <>
                <dt className="text-muted-foreground">Medium</dt>
                <dd>{painting.medium}</dd>
              </>
            )}
            {painting.dimensions && (
              <>
                <dt className="text-muted-foreground">Dimensions</dt>
                <dd>{painting.dimensions}</dd>
              </>
            )}
          </dl>

          {/* Story */}
          {painting.story && (
            <div className="prose prose-sm dark:prose-invert max-w-none mb-8 text-muted-foreground leading-relaxed">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {painting.story}
              </ReactMarkdown>
            </div>
          )}

          {/* CTAs */}
          <div className="mt-auto flex flex-col gap-4">
            {painting.status === "available" && (
              <InquireDialog painting={painting} />
            )}

            {painting.print_available && (
              <PrintRequestDialog
                painting={painting}
                settings={settings}
                paintingUrl={paintingUrl}
              />
            )}

            {painting.commission_available && (
              <Link
                href={`/commission?painting=${encodeURIComponent(painting.title)}&painting_id=${painting.id}`}
                className="inline-flex items-center justify-center h-9 px-4 rounded-lg border border-border bg-background text-sm font-medium hover:bg-muted transition-colors w-fit"
              >
                Available on Commission
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
