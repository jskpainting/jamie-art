"use client"

import { useState, useOptimistic, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import Image from "next/image"
import { Plus, Pencil, Trash2, ImageIcon } from "lucide-react"
import { reorderSections, deleteSection } from "@/lib/actions/sections"
import { SortableList } from "@/components/admin/sortable-list"
import { ConfirmDialog } from "@/components/admin/confirm-dialog"
import { SectionFormDialog } from "@/components/admin/section-form-dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { SectionWithCount } from "@/lib/types"

interface SectionsClientProps {
  initialSections: SectionWithCount[]
  showFocal?: boolean
}

export function SectionsClient({ initialSections, showFocal }: SectionsClientProps) {
  const [sections, setOptimistic] = useOptimistic(initialSections)
  const [, startTransition] = useTransition()
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)
  const [editSection, setEditSection] = useState<SectionWithCount | null>(null)

  function handleLocalReorder(newIds: string[]) {
    const reordered = newIds
      .map((id) => sections.find((s) => s.id === id))
      .filter((s): s is SectionWithCount => !!s)
    startTransition(async () => {
      setOptimistic(reordered)
      const result = await reorderSections(newIds)
      if (!result.ok) toast.error(result.error)
      else toast.success("Order saved", { duration: 1500 })
    })
  }

  async function handleDelete(section: SectionWithCount) {
    const result = await deleteSection(section.id)
    if (!result.ok) {
      toast.error(result.error)
    } else {
      const n = result.movedCount ?? 0
      toast.success(
        n === 0
          ? "Section deleted."
          : n === 1
            ? "Section deleted. 1 painting moved to Uncategorized."
            : `Section deleted. ${n} paintings moved to Uncategorized.`
      )
      router.refresh()
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add section
        </Button>
      </div>

      <SortableList
        items={sections}
        onReorder={handleLocalReorder}
        renderItem={(section, handle) => {
          const isUncategorized = section.slug === "uncategorized"
          return (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-border bg-card p-3">
              <div className="flex items-center gap-3 min-w-0">
                {handle}

                {/* Thumbnail */}
                <div className="relative h-12 w-12 shrink-0 overflow-hidden bg-muted">
                  {section.cover_image_url ? (
                    <Image
                      src={section.cover_image_url}
                      alt={section.title}
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <ImageIcon className="h-4 w-4 text-muted-foreground/40" />
                    </div>
                  )}
                </div>

                {/* Title + slug */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium break-words">{section.title}</p>
                  <p className="text-xs text-muted-foreground font-mono truncate">
                    /{section.slug}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap sm:ml-auto">
                {/* Count */}
                <Badge variant="secondary" className="shrink-0 text-xs">
                  {section.painting_count}{" "}
                  {section.painting_count === 1 ? "painting" : "paintings"}
                </Badge>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditSection(section)}
                    className="h-10 w-10 sm:h-8 sm:w-8 p-0"
                    title="Edit section"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>

                  {isUncategorized ? (
                    <span
                      title="This section can't be deleted — paintings move here when a section is removed."
                      className="inline-flex"
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled
                        className="h-10 w-10 sm:h-8 sm:w-8 p-0 opacity-30 cursor-not-allowed"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </span>
                  ) : (
                    <ConfirmDialog
                      trigger={
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-10 w-10 sm:h-8 sm:w-8 p-0 text-muted-foreground hover:text-destructive"
                          title="Delete section"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      }
                      title={`Delete "${section.title}"?`}
                      description={
                        section.painting_count === 0
                          ? "This section has no paintings. It will be permanently deleted."
                          : `Its ${section.painting_count} ${section.painting_count === 1 ? "painting" : "paintings"} will move to Uncategorized.`
                      }
                      destructive
                      onConfirm={() => handleDelete(section)}
                    />
                  )}

                  <Link
                    href={`/admin/portfolio/${section.slug}`}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }), "ml-1")}
                  >
                    Manage →
                  </Link>
                </div>
              </div>
            </div>
          )
        }}
      />

      <SectionFormDialog open={addOpen} onOpenChange={setAddOpen} showFocal={showFocal} />

      <SectionFormDialog
        open={!!editSection}
        onOpenChange={(open) => { if (!open) setEditSection(null) }}
        section={editSection ?? undefined}
        showFocal={showFocal}
      />
    </div>
  )
}
