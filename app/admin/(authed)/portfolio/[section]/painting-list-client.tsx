"use client"

import { useState, useOptimistic, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import Image from "next/image"
import { Pencil, Trash2, Plus, ImageIcon, Tag, X } from "lucide-react"
import {
  reorderPaintings,
  deletePainting,
  bulkUpdateStatus,
  bulkUpdateSection,
  bulkAddTag,
  bulkRemoveTag,
  bulkDelete,
} from "@/lib/actions/paintings"
import { SortableList } from "@/components/admin/sortable-list"
import { ConfirmDialog } from "@/components/admin/confirm-dialog"
import { EmptyState } from "@/components/admin/empty-state"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { PaintingFormDialog } from "./painting-form-dialog"
import type { PaintingWithImagesAndTags, Section } from "@/lib/types"
import { cn } from "@/lib/utils"

const STATUS_COLORS: Record<string, string> = {
  available: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  sold: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  nfs: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  reserved: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
}

const STATUSES = ["available", "sold", "nfs", "reserved"] as const

interface PaintingListClientProps {
  section: Section
  initialPaintings: PaintingWithImagesAndTags[]
  initialAddOpen?: boolean
  sections: Section[]
}

// ─── Bulk action bar ─────────────────────────────────────────────────────────

interface BulkActionBarProps {
  selectedIds: Set<string>
  selectedPaintings: PaintingWithImagesAndTags[]
  sections: Section[]
  onClear: () => void
}

function BulkActionBar({
  selectedIds,
  selectedPaintings,
  sections,
  onClear,
}: BulkActionBarProps) {
  const ids = [...selectedIds]
  const count = ids.length

  // Collect union of tags across selected paintings
  const tagUnion = [...new Set(selectedPaintings.flatMap((p) => p.tags))]

  // Add/remove tag dialog state
  const [tagDialogOpen, setTagDialogOpen] = useState(false)
  const [tagDialogMode, setTagDialogMode] = useState<"add" | "remove">("add")
  const [tagInput, setTagInput] = useState("")
  const [tagWorking, setTagWorking] = useState(false)

  async function handleStatus(status: string | null) {
    if (!status) return
    const result = await bulkUpdateStatus(ids, status as "available" | "sold" | "nfs" | "reserved")
    if (!result.ok) toast.error(result.error)
    else {
      toast.success(`${result.count} painting${result.count !== 1 ? "s" : ""} updated`)
      onClear()
    }
  }

  async function handleSection(sectionId: string | null) {
    if (!sectionId) return
    const result = await bulkUpdateSection(ids, sectionId)
    if (!result.ok) toast.error(result.error)
    else {
      toast.success(`${result.count} painting${result.count !== 1 ? "s" : ""} moved`)
      onClear()
    }
  }

  async function handleTagSubmit() {
    if (!tagInput.trim()) return
    setTagWorking(true)
    try {
      const result =
        tagDialogMode === "add"
          ? await bulkAddTag(ids, tagInput)
          : await bulkRemoveTag(ids, tagInput)
      if (!result.ok) toast.error(result.error)
      else {
        toast.success(
          `Tag "${tagInput.trim()}" ${tagDialogMode === "add" ? "added to" : "removed from"} ${result.count} painting${result.count !== 1 ? "s" : ""}`
        )
        setTagDialogOpen(false)
        setTagInput("")
        onClear()
      }
    } finally {
      setTagWorking(false)
    }
  }

  async function handleDelete() {
    const result = await bulkDelete(ids)
    if (!result.ok) throw new Error(result.error)
    toast.success(`${result.count} painting${result.count !== 1 ? "s" : ""} deleted`)
    onClear()
  }

  return (
    <>
      <div className="fixed bottom-0 inset-x-0 z-50 border-t border-border bg-card shadow-lg px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-2">
          {/* Count + clear */}
          <span className="text-sm font-medium text-foreground mr-1">
            {count} selected
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClear}
            aria-label="Clear selection"
            className="text-muted-foreground hover:text-foreground mr-2"
          >
            <X className="h-3.5 w-3.5" />
          </Button>

          {/* Status */}
          <Select onValueChange={handleStatus}>
            <SelectTrigger className="h-8 w-auto text-xs min-w-[110px]">
              <SelectValue placeholder="Status…" />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s} className="text-xs capitalize">
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Section */}
          <Select onValueChange={handleSection}>
            <SelectTrigger className="h-8 w-auto text-xs min-w-[120px]">
              <SelectValue placeholder="Move to…" />
            </SelectTrigger>
            <SelectContent>
              {sections.map((s) => (
                <SelectItem key={s.id} value={s.id} className="text-xs">
                  {s.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Add tag */}
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1"
            onClick={() => {
              setTagDialogMode("add")
              setTagInput("")
              setTagDialogOpen(true)
            }}
          >
            <Tag className="h-3 w-3" />
            Add tag
          </Button>

          {/* Remove tag */}
          {tagUnion.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1"
              onClick={() => {
                setTagDialogMode("remove")
                setTagInput("")
                setTagDialogOpen(true)
              }}
            >
              <Tag className="h-3 w-3" />
              Remove tag
            </Button>
          )}

          {/* Delete */}
          <ConfirmDialog
            trigger={
              <Button
                variant="destructive"
                size="sm"
                className="h-8 text-xs"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Delete {count}
              </Button>
            }
            title={`Delete ${count} painting${count !== 1 ? "s" : ""}?`}
            description="This is permanent and cannot be undone."
            destructive
            onConfirm={handleDelete}
          />
        </div>
      </div>

      {/* Tag dialog */}
      <Dialog open={tagDialogOpen} onOpenChange={setTagDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {tagDialogMode === "add" ? "Add tag to" : "Remove tag from"} {count} painting{count !== 1 ? "s" : ""}
            </DialogTitle>
          </DialogHeader>
          {tagDialogMode === "remove" && tagUnion.length > 0 ? (
            <div className="flex flex-wrap gap-2 py-1">
              {tagUnion.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setTagInput(tag)}
                  className={cn(
                    "text-xs px-2.5 py-1 rounded-full border transition-colors",
                    tagInput === tag
                      ? "bg-foreground text-background border-foreground"
                      : "border-border hover:bg-muted"
                  )}
                >
                  {tag}
                </button>
              ))}
            </div>
          ) : (
            <Input
              autoFocus
              placeholder="Tag name…"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleTagSubmit()
              }}
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTagDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleTagSubmit()}
              disabled={tagWorking || !tagInput.trim()}
            >
              {tagDialogMode === "add" ? "Add" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── Painting row (shared between sortable + static lists) ───────────────────

interface PaintingRowProps {
  painting: PaintingWithImagesAndTags
  handle?: React.ReactNode
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  onEdit: () => void
  onDeleted: () => void
}

function PaintingRow({ painting, handle, checked, onCheckedChange, onEdit, onDeleted }: PaintingRowProps) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
      {/* Checkbox */}
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(v === true)}
        aria-label={`Select ${painting.title}`}
        className="shrink-0"
      />

      {/* Drag handle (only for active paintings) */}
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

      {/* Content */}
      <div className="flex flex-col sm:flex-row sm:items-center flex-1 min-w-0 gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{painting.title}</p>
          <p className="text-xs text-muted-foreground">
            {painting.year ?? "—"}
            {painting.medium ? ` · ${painting.medium}` : ""}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-xs px-2 py-0.5 rounded-full font-medium shrink-0",
              STATUS_COLORS[painting.status] ?? ""
            )}
          >
            {painting.status}
          </span>

          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-foreground/60 hover:text-foreground"
              onClick={onEdit}
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
                onDeleted()
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PaintingListClient({
  section,
  initialPaintings,
  initialAddOpen = false,
  sections,
}: PaintingListClientProps) {
  const [paintings, setOptimistic] = useOptimistic(initialPaintings)
  useTransition()
  const [addOpen, setAddOpen] = useState(initialAddOpen)
  const [editPainting, setEditPainting] = useState<PaintingWithImagesAndTags | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const router = useRouter()

  useEffect(() => {
    if (initialAddOpen) router.replace(`/admin/portfolio/${section.slug}`)
  }, [initialAddOpen, router, section.slug])

  // Two-tier split (query already returns active first, sold last — preserve that)
  const activePaintings = paintings.filter((p) => p.status !== "sold")
  const soldPaintings = paintings.filter((p) => p.status === "sold")
  const allIds = paintings.map((p) => p.id)
  const selectedPaintings = paintings.filter((p) => selectedIds.has(p.id))

  // Select all/none
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id))
  const someSelected = !allSelected && allIds.some((id) => selectedIds.has(id))

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(allIds))
    }
  }

  function toggleOne(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function handleLocalReorder(newIds: string[]) {
    const reordered = newIds
      .map((id) => activePaintings.find((p) => p.id === id))
      .filter((p): p is PaintingWithImagesAndTags => !!p)
    setOptimistic([...reordered, ...soldPaintings])
    void reorderPaintings(section.id, newIds).then((result) => {
      if (!result.ok) toast.error(result.error)
      else toast.success("Order saved", { duration: 1500 })
    })
  }

  function clearSelection() {
    setSelectedIds(new Set())
  }

  const isEmpty = paintings.length === 0

  return (
    <div className={cn("space-y-4", selectedIds.size > 0 && "pb-20")}>
      <div className="flex justify-between items-center">
        {/* Select-all checkbox (only shown when there are paintings) */}
        {!isEmpty && (
          <div className="flex items-center gap-2">
            <Checkbox
              checked={allSelected}
              indeterminate={someSelected}
              onCheckedChange={toggleAll}
              aria-label="Select all paintings"
            />
            <span className="text-xs text-muted-foreground">
              {selectedIds.size > 0 ? `${selectedIds.size} selected` : "Select all"}
            </span>
          </div>
        )}
        <div className={cn("flex justify-end", isEmpty && "w-full")}>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add painting
          </Button>
        </div>
      </div>

      {isEmpty ? (
        <EmptyState
          icon={ImageIcon}
          message="Add the first painting to this section."
          action={{ label: "Add painting", onClick: () => setAddOpen(true) }}
        />
      ) : (
        <>
          {/* Active paintings — sortable */}
          {activePaintings.length > 0 && (
            <SortableList
              items={activePaintings}
              onReorder={handleLocalReorder}
              renderItem={(painting, handle) => (
                <PaintingRow
                  painting={painting}
                  handle={handle}
                  checked={selectedIds.has(painting.id)}
                  onCheckedChange={(v) => toggleOne(painting.id, v)}
                  onEdit={() => setEditPainting(painting)}
                  onDeleted={clearSelection}
                />
              )}
            />
          )}

          {/* Sold paintings — static, non-draggable */}
          {soldPaintings.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.2em] font-medium text-muted-foreground pt-2">
                Sold · sorted by date
              </p>
              {soldPaintings.map((painting) => (
                <PaintingRow
                  key={painting.id}
                  painting={painting}
                  checked={selectedIds.has(painting.id)}
                  onCheckedChange={(v) => toggleOne(painting.id, v)}
                  onEdit={() => setEditPainting(painting)}
                  onDeleted={clearSelection}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <BulkActionBar
          selectedIds={selectedIds}
          selectedPaintings={selectedPaintings}
          sections={sections}
          onClear={clearSelection}
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
          defaultTags={editPainting.tags}
        />
      )}
    </div>
  )
}
