"use client"

import { useState, useOptimistic, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import Image from "next/image"
import { Pencil, Trash2, Plus, ImageIcon } from "lucide-react"
import { reorderPaintings, deletePainting } from "@/lib/actions/paintings"
import { SortableList } from "@/components/admin/sortable-list"
import { ConfirmDialog } from "@/components/admin/confirm-dialog"
import { EmptyState } from "@/components/admin/empty-state"
import { Button } from "@/components/ui/button"
import { PaintingFormDialog } from "./painting-form-dialog"
import type { PaintingWithImages, Section } from "@/lib/types"
import { cn } from "@/lib/utils"

const STATUS_COLORS: Record<string, string> = {
  available: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  sold: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  nfs: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  reserved: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
}

interface PaintingListClientProps {
  section: Section
  initialPaintings: PaintingWithImages[]
  initialAddOpen?: boolean
}

export function PaintingListClient({
  section,
  initialPaintings,
  initialAddOpen = false,
}: PaintingListClientProps) {
  const [paintings, setOptimistic] = useOptimistic(initialPaintings)
  useTransition()
  const [addOpen, setAddOpen] = useState(initialAddOpen)
  const [editPainting, setEditPainting] = useState<PaintingWithImages | null>(null)
  const router = useRouter()

  useEffect(() => {
    if (initialAddOpen) router.replace(`/admin/portfolio/${section.slug}`)
  }, [initialAddOpen, router, section.slug])

  function handleLocalReorder(newIds: string[]) {
    const reordered = newIds
      .map((id) => paintings.find((p) => p.id === id))
      .filter((p): p is PaintingWithImages => !!p)
    setOptimistic(reordered)
    void reorderPaintings(section.id, newIds).then((result) => {
      if (!result.ok) toast.error(result.error)
      else toast.success("Order saved", { duration: 1500 })
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add painting
        </Button>
      </div>

      {paintings.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          message="Add the first painting to this section."
          action={{ label: "Add painting", onClick: () => setAddOpen(true) }}
        />
      ) : (
        <SortableList
          items={paintings}
          onReorder={handleLocalReorder}
          renderItem={(painting, handle) => (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
              {handle}

              {/* Thumbnail */}
              <div className="relative h-12 w-12 shrink-0 overflow-hidden bg-muted">
                {painting.primary_image_url ? (
                  <Image
                    src={painting.primary_image_url}
                    alt={painting.title}
                    fill
                    sizes="48px"
                    className="object-cover"
                  />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-muted to-muted/30" />
                )}
              </div>

              {/* Content: info + badge + actions */}
              <div className="flex flex-col sm:flex-row sm:items-center flex-1 min-w-0 gap-2">
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{painting.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {painting.year ?? "—"}
                    {painting.medium ? ` · ${painting.medium}` : ""}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {/* Status badge */}
                  <span
                    className={cn(
                      "text-xs px-2 py-0.5 rounded-full font-medium shrink-0",
                      STATUS_COLORS[painting.status] ?? ""
                    )}
                  >
                    {painting.status}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-foreground/60 hover:text-foreground"
                      onClick={() => setEditPainting(painting)}
                      aria-label="Edit painting"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <ConfirmDialog
                      trigger={
                        <Button variant="ghost" size="icon-sm" aria-label="Delete painting">
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      }
                      title="Delete painting"
                      description={`"${painting.title}" will be permanently deleted along with all its images.`}
                      destructive
                      onConfirm={async () => {
                        const result = await deletePainting(painting.id)
                        if (!result.ok) throw new Error(result.error)
                        toast.success("Painting deleted")
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        />
      )}

      {/* Add dialog */}
      <PaintingFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        sectionId={section.id}
      />

      {/* Edit dialog */}
      {editPainting && (
        <PaintingFormDialog
          open={!!editPainting}
          onOpenChange={(o) => !o && setEditPainting(null)}
          sectionId={section.id}
          painting={editPainting}
        />
      )}
    </div>
  )
}
