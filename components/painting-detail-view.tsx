"use client"

import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import Image from "next/image"
import Link from "next/link"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { ChevronLeft, Maximize2, Palette } from "lucide-react"
import { InquireDialog } from "@/components/inquire-dialog"
import { PrintRequestDialog } from "@/components/print-request-dialog"
import { ZoomOverlay } from "@/components/zoom-overlay"
import { ArViewer } from "@/components/ar-viewer"
import { formatPrice, cn } from "@/lib/utils"
import { paintingAlt } from "@/lib/site"
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

function subscribeNoop() {
  return () => {}
}
function getArRequestedSnapshot() {
  if (typeof window === "undefined") return false
  return new URLSearchParams(window.location.search).get("ar") === "1"
}
function getArRequestedServerSnapshot() {
  return false
}

interface PaintingDetailViewProps {
  painting: PaintingWithImages
  sectionSlug: string
  sectionTitle: string
  settings: Settings | null
  paintingUrl: string
  /** Public .glb URL if this painting has an AR model (enables "View on my wall"). */
  arModelUrl?: string | null
}

export function PaintingDetailView({
  painting,
  sectionSlug,
  sectionTitle,
  settings,
  paintingUrl,
  arModelUrl,
}: PaintingDetailViewProps) {
  const [zoomOpen, setZoomOpen] = useState(false)

  // `?ar=1` (QR-card deep link): auto-open the AR viewer's first step so the
  // model-viewer library + .glb start loading immediately, then smooth-scroll
  // it into view once mounted. Read via window.location.search — NOT
  // useSearchParams/server searchParams — so this page stays static and
  // CSR-bailout-free. Nothing else changes under this param.
  const arRequested = useSyncExternalStore(
    subscribeNoop,
    getArRequestedSnapshot,
    getArRequestedServerSnapshot
  )
  const arSectionRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!arRequested || !arModelUrl) return
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    const timer = setTimeout(() => {
      arSectionRef.current?.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "center",
      })
    }, 800)
    return () => clearTimeout(timer)
  }, [arRequested, arModelUrl])

  const priceDisplay =
    painting.status === "available" && painting.price_cents
      ? formatPrice(painting.price_cents)
      : null

  const additionalImages = painting.painting_images ?? []

  const specs = [
    painting.year && { label: "Year", value: String(painting.year) },
    painting.medium && { label: "Medium", value: painting.medium },
    painting.dimensions && { label: "Dimensions", value: painting.dimensions },
  ].filter(Boolean) as { label: string; value: string }[]

  const hasSecondary = painting.print_available || painting.commission_available

  return (
    <div className="max-w-7xl mx-auto px-6 md:px-10 py-8 md:py-14">
      {/* Breadcrumb */}
      <Link
        href={`/portfolio/${sectionSlug}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        {sectionTitle}
      </Link>

      <div className="mt-6 grid lg:grid-cols-12 gap-10 lg:gap-14 items-start">
        {/* Artwork */}
        <div className="lg:col-span-7 xl:col-span-8">
          {painting.primary_image_url ? (
            <>
              <button
                type="button"
                onClick={() => setZoomOpen(true)}
                aria-label={`Enlarge ${painting.title}`}
                className="group relative block w-full cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
              >
                <Image
                  src={painting.primary_image_url}
                  alt={paintingAlt(painting.title)}
                  width={painting.width ?? 1200}
                  height={painting.height ?? 900}
                  sizes="(max-width: 1024px) 100vw, 66vw"
                  className="w-full h-auto max-h-[80vh] object-contain"
                  quality={90}
                  priority
                />
                {/* Enlarge affordance */}
                <span className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-background/85 px-3 py-1.5 text-xs font-medium text-foreground opacity-0 backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100">
                  <Maximize2 className="h-3.5 w-3.5" />
                  Enlarge
                </span>
              </button>
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

          {/* Additional images */}
          {additionalImages.length > 0 && (
            <div className="mt-4 grid grid-cols-4 gap-3">
              {additionalImages.map((img) => (
                <div
                  key={img.id}
                  className="relative aspect-square overflow-hidden bg-muted"
                >
                  <Image
                    src={img.url}
                    alt={paintingAlt(painting.title, img.alt)}
                    fill
                    sizes="20vw"
                    quality={85}
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Placard */}
        <aside className="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-24">
          <p className="text-xs uppercase tracking-[0.22em] font-medium text-muted-foreground">
            {sectionTitle}
          </p>
          <h1 className="mt-2 font-serif text-3xl md:text-4xl font-light tracking-tight leading-[1.1]">
            {painting.title}
          </h1>

          {/* Status + price */}
          <div className="mt-5 flex items-center justify-between gap-4 border-b border-border pb-5">
            <span
              className={cn(
                "text-xs px-2.5 py-1 rounded-full font-medium",
                statusStyle[painting.status]
              )}
            >
              {statusLabel[painting.status]}
            </span>
            {priceDisplay && (
              <span className="font-serif text-2xl font-light tabular-nums">
                {priceDisplay}
              </span>
            )}
          </div>

          {/* Spec list */}
          {specs.length > 0 && (
            <dl className="divide-y divide-border border-b border-border">
              {specs.map((s) => (
                <div
                  key={s.label}
                  className="flex items-baseline justify-between gap-6 py-3"
                >
                  <dt className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                    {s.label}
                  </dt>
                  <dd className="text-sm font-medium text-right">{s.value}</dd>
                </div>
              ))}
            </dl>
          )}

          {/* Story — never rendered when the owner has marked it private */}
          {painting.story && painting.story_public !== false && (
            <div className="prose prose-sm dark:prose-invert max-w-none mt-6 text-muted-foreground leading-relaxed">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {painting.story}
              </ReactMarkdown>
            </div>
          )}

          {/* Actions */}
          <div className="mt-7 flex flex-col gap-3">
            {painting.status === "available" ? (
              <>
                <InquireDialog
                  painting={painting}
                  settings={settings}
                  className="w-full h-11 text-[15px] rounded-full"
                />
                <p className="text-xs text-muted-foreground text-center">
                  Your message goes straight to Jamie&rsquo;s inbox — a reply
                  usually lands within a few days.
                </p>
              </>
            ) : (
              <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                {painting.status === "sold"
                  ? "This piece has found its home. Explore more available work below."
                  : painting.status === "reserved"
                    ? "This piece is currently reserved."
                    : "This piece is not for sale, but it may be available as a print or commission."}
              </div>
            )}

            {hasSecondary && (
              <div className="mt-1 flex flex-col gap-4 border-t border-border pt-5">
                {painting.print_available && (
                  <PrintRequestDialog
                    painting={painting}
                    settings={settings}
                    paintingUrl={paintingUrl}
                  />
                )}

                {painting.commission_available && (
                  <div className="flex flex-col gap-2">
                    <span className="text-xs uppercase tracking-[0.2em] font-medium text-muted-foreground">
                      Commissions
                    </span>
                    <Link
                      href={`/commission?painting=${encodeURIComponent(painting.title)}&painting_id=${painting.id}`}
                      className="inline-flex w-fit items-center gap-2 h-9 px-4 rounded-full border border-border bg-background text-sm font-medium hover:bg-muted transition-colors"
                    >
                      <Palette className="h-4 w-4" />
                      Request a similar painting on commission
                    </Link>
                  </div>
                )}
              </div>
            )}

            {arModelUrl && (
              <div
                ref={arSectionRef}
                className="mt-1 flex flex-col gap-3 border-t border-border pt-5"
              >
                <span className="text-xs uppercase tracking-[0.2em] font-medium text-muted-foreground">
                  See it in your space
                </span>
                <ArViewer
                  src={arModelUrl}
                  alt={paintingAlt(painting.title)}
                  promoted={arRequested}
                />
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
