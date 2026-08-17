"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { PairsGallery } from "@/components/gallery/pairs-gallery"
import { MosaicGallery } from "@/components/gallery/mosaic-gallery"
import { ColumnsGallery } from "@/components/gallery/columns-gallery"
import { updateActiveLayout } from "@/lib/actions/settings"
import type { GalleryLayout, Painting } from "@/lib/types"

// Mirrors lib/schema-capabilities.ts SCHEMA_SETUP_MESSAGE — duplicated (not
// imported) because that module pulls in server-only Supabase clients and
// can't be imported from a client component.
const SCHEMA_SETUP_MESSAGE =
  "This feature needs a quick one-time setup that hasn't run yet — everything else works normally."

type PaintingInGallery = Painting & { home_section_slug?: string }

const layoutNotes: Record<GalleryLayout, { title: string; body: string }> = {
  pairs: {
    title: "A · Two per row",
    body: "Max two paintings per row, each sized to its real dimensions so bigger canvases read bigger and nothing is cropped. Spacious and gallery-like; rows vary in height. Best when you want each piece to breathe.",
  },
  mosaic: {
    title: "B · Column mosaic",
    body: "A fixed 4-column grid; large canvases span two columns. Densest and most structured — everything aligns to columns, no gaps. Best for browsing a lot of work at once.",
  },
  columns: {
    title: "C · Uniform columns",
    body: "A clean 3-column masonry, every painting the same width, height by true shape. The most orderly and predictable; size relevance comes only from height + the labels.",
  },
}

const layoutTabLabel: Record<GalleryLayout, string> = {
  pairs: "A · Two per row",
  mosaic: "B · Mosaic",
  columns: "C · Columns",
}

interface LayoutPreviewClientProps {
  paintings: PaintingInGallery[]
  activeLayout: GalleryLayout
  canActivate: boolean
}

export function LayoutPreviewClient({
  paintings,
  activeLayout: initialActiveLayout,
  canActivate,
}: LayoutPreviewClientProps) {
  const [tab, setTab] = useState<GalleryLayout>(initialActiveLayout)
  const [activeLayout, setActiveLayout] = useState<GalleryLayout>(initialActiveLayout)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const notes = layoutNotes[tab]
  const isViewingActive = tab === activeLayout

  function activate() {
    const previous = activeLayout
    const next = tab
    startTransition(async () => {
      const result = await updateActiveLayout(next)
      if (!result.ok) {
        toast.error(result.error ?? "Couldn't update the layout", { duration: 5000 })
        return
      }
      setActiveLayout(next)
      toast.success(`Portfolio switched to "${layoutNotes[next].title}".`, {
        duration: 5000,
        action: {
          label: "Undo",
          onClick: () => {
            startTransition(async () => {
              const undoResult = await updateActiveLayout(previous)
              if (undoResult.ok) {
                setActiveLayout(previous)
                setTab(previous)
                toast.success("Reverted.", { duration: 5000 })
              } else {
                toast.error(undoResult.error ?? "Couldn't undo", { duration: 5000 })
              }
            })
          },
        },
      })
    })
  }

  return (
    <div className="space-y-6">
      <Tabs value={tab} onValueChange={(v) => setTab(v as GalleryLayout)}>
        <TabsList>
          {(Object.keys(layoutTabLabel) as GalleryLayout[]).map((key) => (
            <TabsTrigger key={key} value={key}>
              {layoutTabLabel[key]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] font-medium text-muted-foreground mb-2">
              Notes — {notes.title}
              {tab === activeLayout && (
                <span className="ml-2 inline-flex items-center rounded-full bg-accent/15 px-2 py-0.5 text-[10px] tracking-normal normal-case font-medium text-accent">
                  Live now
                </span>
              )}
            </p>
            <p className="text-sm leading-relaxed text-card-foreground max-w-2xl">{notes.body}</p>
          </div>

          <div className="shrink-0">
            {isViewingActive ? (
              <p className="text-xs text-muted-foreground whitespace-nowrap">
                This is what visitors see today.
              </p>
            ) : canActivate ? (
              <>
                <Button onClick={() => setConfirmOpen(true)} disabled={isPending}>
                  Make this the site layout
                </Button>
                <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Switch the portfolio layout?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Your portfolio pages will switch to &quot;{notes.title}&quot;. You can
                        switch back anytime.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={activate} disabled={isPending}>
                        Switch layout
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            ) : (
              <p className="text-xs text-muted-foreground max-w-[220px] text-right">
                {SCHEMA_SETUP_MESSAGE}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="w-full">
        {tab === "pairs" && <PairsGallery paintings={paintings} sectionSlug="abstracts" />}
        {tab === "mosaic" && <MosaicGallery paintings={paintings} sectionSlug="abstracts" />}
        {tab === "columns" && <ColumnsGallery paintings={paintings} sectionSlug="abstracts" />}
      </div>
    </div>
  )
}
