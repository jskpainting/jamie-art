"use client"

import {
  useState,
  useMemo,
  useCallback,
  useOptimistic,
  useTransition,
  useEffect,
} from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import Image from "next/image"
import {
  Pencil,
  Trash2,
  Plus,
  ImageIcon,
  Tag,
  X,
  Upload,
  FolderInput,
  GripVertical,
} from "lucide-react"
import {
  reorderPaintings,
  deletePainting,
  bulkUpdateStatus,
  bulkUpdateSection,
  bulkAddTag,
  bulkRemoveTag,
  bulkDelete,
  setPaintingSectionMembership,
} from "@/lib/actions/paintings"
import { SortableList } from "@/components/admin/sortable-list"
import { ListToolbar, FilteredEmptyState } from "@/components/admin/list-toolbar"
import { ConfirmDialog } from "@/components/admin/confirm-dialog"
import { EmptyState } from "@/components/admin/empty-state"
import { Button, buttonVariants } from "@/components/ui/button"
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

// Admin-only "Featured" positional marker — purely visual, nothing is
// persisted beyond the normal sort_order. See painting-list-client below.
const FEATURED_COUNT = 4

interface PaintingListClientProps {
  section: Section
  initialPaintings: PaintingWithImagesAndTags[]
  initialAddOpen?: boolean
  sections: Section[]
  /** Whether the painting_sections migration is applied (enables "Also show in"). */
  showAlsoShowIn?: boolean
  /** Whether the story_public/story_notes migration is applied (enables the AI story writer). */
  storyToolsEnabled?: boolean
}

// ─── Bulk action bar ─────────────────────────────────────────────────────────

interface BulkActionBarProps {
  hiddenCount?: number
  onShowAll?: () => void
  selectedIds: Set<string>
  selectedPaintings: PaintingWithImagesAndTags[]
  sections: Section[]
  onClear: () => void
}

function BulkActionBar({
  hiddenCount = 0,
  onShowAll,
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
            {hiddenCount > 0 && onShowAll && (
              <>
                {" "}
                <button
                  type="button"
                  onClick={onShowAll}
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  ({hiddenCount} hidden right now — show all)
                </button>
              </>
            )}
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
  sections: Section[]
  currentSectionId: string
  onMove: (targetSectionId: string) => void
  onToggleSection: (targetSectionId: string, on: boolean) => void
  showAlsoShowIn?: boolean
}

function PaintingRow({ painting, handle, checked, onCheckedChange, onEdit, onDeleted, sections, currentSectionId, onMove, onToggleSection, showAlsoShowIn }: PaintingRowProps) {
  const otherSections = sections.filter((s) => s.id !== currentSectionId)
  const currentSectionTitle =
    sections.find((s) => s.id === currentSectionId)?.title ?? "this gallery"
  const extra = new Set(painting.extra_section_ids ?? [])
  // Move uses a Dialog, NOT a Base UI dropdown menu: a portal MENU opened from
  // inside the dnd-kit sortable row crashes the page (renderer loop). Dialogs
  // (like the delete ConfirmDialog in this same row) are safe here.
  const [moveOpen, setMoveOpen] = useState(false)
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
            {/* Quick move to another gallery (Dialog — see note above). Always
                rendered, even with no other galleries — the dialog explains
                why in that case rather than the feature silently vanishing. */}
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-foreground/60 hover:text-foreground"
              aria-label="Move to another gallery"
              onClick={() => setMoveOpen(true)}
            >
              <FolderInput className="h-3.5 w-3.5" />
            </Button>
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

      {/* Move dialog */}
      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="truncate">“{painting.title}”</DialogTitle>
          </DialogHeader>

          {/* Move — removes it from the current gallery */}
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
              Move to another gallery
            </p>
            {otherSections.length > 0 ? (
              <>
                <p className="text-xs text-muted-foreground mb-2">
                  Moves it out of {currentSectionTitle} and into the one you pick.
                </p>
                {otherSections.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setMoveOpen(false)
                      onMove(s.id)
                    }}
                    className="w-full text-left text-sm px-3 py-2 rounded-md border border-transparent hover:bg-muted hover:border-border transition-colors"
                  >
                    {s.title}
                  </button>
                ))}
              </>
            ) : (
              <p className="text-xs text-muted-foreground leading-relaxed">
                There are no other galleries yet — add another section under
                Portfolio to move paintings between galleries.
              </p>
            )}
          </div>

          {/* Also show in — keeps it here AND adds it to others (multi-gallery) */}
          <div className="space-y-2 border-t border-border pt-3">
            <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
              Also show in
            </p>
            {showAlsoShowIn ? (
              <>
                <p className="text-xs text-muted-foreground mb-1">
                  Keeps it in {currentSectionTitle} and also shows it in the
                  galleries you tick.
                </p>
                {otherSections.map((s) => (
                  <label
                    key={`extra-${s.id}`}
                    className="flex items-center gap-2 text-sm px-1 py-1 cursor-pointer"
                  >
                    <Checkbox
                      checked={extra.has(s.id)}
                      onCheckedChange={(v) => onToggleSection(s.id, v === true)}
                    />
                    {s.title}
                  </label>
                ))}
              </>
            ) : (
              <p className="text-xs text-muted-foreground leading-relaxed">
                Showing one painting in several galleries at once needs a quick
                one-time setup (in the email sent to you). Once that’s done,
                you’ll be able to tick galleries here.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type PaintingFilter =
  | "all"
  | "available"
  | "sold"
  | "reserved"
  | "nfs"
  | "no-photo"
  | "no-price"
type PaintingSort = "owner" | "newest" | "oldest" | "title" | "year-new" | "year-old"

const PAINTING_FILTER_OPTIONS = [
  { value: "all", label: "All paintings" },
  { value: "available", label: "Available" },
  { value: "sold", label: "Sold" },
  { value: "reserved", label: "Reserved" },
  { value: "nfs", label: "Not for sale" },
  { value: "no-photo", label: "Needs a photo" },
  { value: "no-price", label: "For sale but no price" },
]

const PAINTING_SORT_OPTIONS = [
  { value: "owner", label: "My order (drag to rearrange)" },
  { value: "newest", label: "Newest added first" },
  { value: "oldest", label: "Oldest added first" },
  { value: "title", label: "Title A–Z" },
  { value: "year-new", label: "Year painted, newest first" },
  { value: "year-old", label: "Year painted, oldest first" },
]

/** Same footprint as the real drag handle, but visibly inert. */
function LockedHandle() {
  return (
    <span
      aria-hidden
      className="inline-flex h-8 w-8 items-center justify-center opacity-25"
    >
      <GripVertical className="h-4 w-4" />
    </span>
  )
}

export function PaintingListClient({
  section,
  initialPaintings,
  initialAddOpen = false,
  sections,
  showAlsoShowIn = false,
  storyToolsEnabled = false,
}: PaintingListClientProps) {
  const [paintings, setOptimistic] = useOptimistic(initialPaintings)
  const [, startTransition] = useTransition()
  const [addOpen, setAddOpen] = useState(initialAddOpen)
  const [editPainting, setEditPainting] = useState<PaintingWithImagesAndTags | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<PaintingFilter>("all")
  const [sort, setSort] = useState<PaintingSort>("owner")
  const router = useRouter()

  useEffect(() => {
    if (initialAddOpen) router.replace(`/admin/portfolio/${section.slug}`)
  }, [initialAddOpen, router, section.slug])

  // The query still returns active-by-sort_order then sold-by-date (twoTierSort)
  // so the very first render preserves today's on-screen order exactly — it's
  // just rendered as one freely-orderable list now instead of two frozen groups.
  const selectedPaintings = paintings.filter((p) => selectedIds.has(p.id))

  // Dragging renumbers sort_order for exactly the ids it is handed, so it is
  // only safe when every painting is on screen in the owner's own order. Any
  // search, filter or sort turns it off; the stored order is never touched.
  const isOwnerView =
    sort === "owner" && filter === "all" && search.trim() === ""

  const resetView = useCallback(() => {
    setSearch("")
    setFilter("all")
    setSort("owner")
  }, [])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    let rows = paintings.filter((p) => {
      if (filter === "no-photo") {
        if (p.primary_image_url) return false
      } else if (filter === "no-price") {
        if (p.status !== "available" || p.price_cents != null) return false
      } else if (filter !== "all") {
        if (p.status !== filter) return false
      }
      if (!q) return true
      return (
        p.title.toLowerCase().includes(q) ||
        (p.medium ?? "").toLowerCase().includes(q) ||
        (p.tags ?? []).some((t) => t.toLowerCase().includes(q))
      )
    })
    if (sort === "title") {
      rows = [...rows].sort((a, b) => a.title.localeCompare(b.title))
    } else if (sort === "newest") {
      rows = [...rows].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    } else if (sort === "oldest") {
      rows = [...rows].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
    } else if (sort === "year-new") {
      rows = [...rows].sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
    } else if (sort === "year-old") {
      rows = [...rows].sort((a, b) => (a.year ?? 0) - (b.year ?? 0))
    }
    return rows
  }, [paintings, search, filter, sort])

  const visibleIds = visible.map((p) => p.id)
  const visibleIdSet = useMemo(() => new Set(visibleIds), [visibleIds])
  // Selection survives a filter change on purpose, so anything it is hiding has
  // to be disclosed — a bulk action about to hit rows the owner cannot see is
  // the most dangerous state on this page.
  const hiddenSelectedCount = [...selectedIds].filter(
    (id) => !visibleIdSet.has(id)
  ).length

  // Select all/none
  const allSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id))
  const someSelected =
    !allSelected && visibleIds.some((id) => selectedIds.has(id))

  function toggleAll() {
    if (allSelected) {
      // Clear everything, including rows the current view is hiding, so there
      // is never invisible residue left selected.
      setSelectedIds(new Set())
    } else {
      setSelectedIds((prev) => new Set([...prev, ...visibleIds]))
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
    // Third line of defence: a reorder computed from anything other than the
    // complete owner-ordered list would renumber a subset and collide with the
    // untouched sort_order of every hidden painting.
    if (!isOwnerView || newIds.length !== paintings.length) return
    const reordered = newIds
      .map((id) => paintings.find((p) => p.id === id))
      .filter((p): p is PaintingWithImagesAndTags => !!p)
    // Optimistic dispatch must run inside a transition (React 19), otherwise the
    // reorder visually snaps back until the server round-trip lands.
    startTransition(async () => {
      setOptimistic(reordered)
      // reorderPaintings sets sort_order = index for every id passed in, sold
      // included — this also normalises sort_order across the whole list on
      // the very first save. The public gallery honours this: sold paintings
      // are ordered by sold_at when it is set and by sort_order otherwise,
      // which is the case for 71 of the 74 sold works.
      const result = await reorderPaintings(section.id, newIds)
      if (!result.ok) toast.error(result.error)
      else toast.success("Order saved", { duration: 1500 })
    })
  }

  function clearSelection() {
    setSelectedIds(new Set())
  }

  function handleMoveOne(id: string, targetSectionId: string) {
    const target = sections.find((s) => s.id === targetSectionId)
    void bulkUpdateSection([id], targetSectionId).then((result) => {
      if (!result.ok) {
        toast.error(result.error)
      } else {
        toast.success(`Moved to ${target?.title ?? "gallery"}`)
        router.refresh()
      }
    })
  }

  function handleToggleSection(id: string, targetSectionId: string, on: boolean) {
    const target = sections.find((s) => s.id === targetSectionId)
    void setPaintingSectionMembership(id, targetSectionId, on).then((result) => {
      if (!result.ok) {
        toast.error(result.error)
      } else {
        toast.success(
          on
            ? `Now also showing in ${target?.title ?? "gallery"}`
            : `Removed from ${target?.title ?? "gallery"}`
        )
        router.refresh()
      }
    })
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
              {selectedIds.size > 0
                ? hiddenSelectedCount > 0
                  ? `${selectedIds.size} selected · ${hiddenSelectedCount} hidden right now`
                  : `${selectedIds.size} selected`
                : isOwnerView
                  ? "Select all"
                  : `Select all ${visibleIds.length} shown`}
            </span>
          </div>
        )}
        <div className={cn("flex items-center gap-2 justify-end", isEmpty && "w-full")}>
          <Link
            href={`/admin/portfolio/bulk-upload?section=${section.slug}`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <Upload className="h-4 w-4 mr-1" />
            Bulk upload
          </Link>
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
          <ListToolbar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search by title, medium or tag…"
            searchLabel="Search paintings"
            filterValue={filter}
            onFilterChange={(v) => setFilter(v as PaintingFilter)}
            filterOptions={PAINTING_FILTER_OPTIONS}
            filterLabel="Show only"
            sortValue={sort}
            onSortChange={(v) => setSort(v as PaintingSort)}
            sortOptions={PAINTING_SORT_OPTIONS}
            sortLabel="Order this list by"
            resultCount={visible.length}
            totalCount={paintings.length}
            itemNoun="paintings"
            hasActiveFilters={!isOwnerView}
            onClear={resetView}
          />

          {!isOwnerView && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-dashed border-border px-3 py-2">
              <p className="text-xs text-muted-foreground">
                {search.trim() !== "" || filter !== "all"
                  ? "Some paintings are hidden right now, so dragging is switched off."
                  : "You're viewing these in a different order, so dragging is switched off."}{" "}
                Your website still shows your own order — nothing has changed.
              </p>
              <Button size="sm" variant="outline" onClick={resetView}>
                Back to my order
              </Button>
            </div>
          )}

          {/* Admin-only ordering aid — visitors never see this, it's purely
              about where things sit in this list. */}
          {isOwnerView && (
            <div className="space-y-0.5 pb-1">
              <p className="text-xs uppercase tracking-[0.2em] font-medium text-muted-foreground">
                Featured — shown first in your admin list
              </p>
              <p className="text-xs text-muted-foreground">
                Drag any painting anywhere. Visitors always see available work
                first and sold work last.
              </p>
            </div>
          )}

          {visible.length === 0 ? (
            <FilteredEmptyState
              query={search}
              itemNoun="paintings"
              onClear={resetView}
            />
          ) : !isOwnerView ? (
            <div className="space-y-2">
              {visible.map((painting) => (
                <PaintingRow
                  key={painting.id}
                  painting={painting}
                  handle={<LockedHandle />}
                  checked={selectedIds.has(painting.id)}
                  onCheckedChange={(v) => toggleOne(painting.id, v)}
                  onEdit={() => setEditPainting(painting)}
                  onDeleted={clearSelection}
                  sections={sections}
                  currentSectionId={section.id}
                  onMove={(target) => handleMoveOne(painting.id, target)}
                  onToggleSection={(target, on) =>
                    handleToggleSection(painting.id, target, on)
                  }
                  showAlsoShowIn={showAlsoShowIn}
                />
              ))}
            </div>
          ) : (
          <SortableList
            items={paintings}
            onReorder={handleLocalReorder}
            renderItem={(painting, handle) => {
              const idx = paintings.findIndex((p) => p.id === painting.id)
              return (
                <>
                  {idx === FEATURED_COUNT && paintings.length > FEATURED_COUNT && (
                    <div className="flex items-center gap-2 py-2" aria-hidden>
                      <div className="h-px flex-1 bg-border" />
                      <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/70">
                        Rest of the gallery
                      </span>
                      <div className="h-px flex-1 bg-border" />
                    </div>
                  )}
                  <PaintingRow
                    painting={painting}
                    handle={handle}
                    checked={selectedIds.has(painting.id)}
                    onCheckedChange={(v) => toggleOne(painting.id, v)}
                    onEdit={() => setEditPainting(painting)}
                    onDeleted={clearSelection}
                    sections={sections}
                    currentSectionId={section.id}
                    onMove={(target) => handleMoveOne(painting.id, target)}
                    onToggleSection={(target, on) =>
                      handleToggleSection(painting.id, target, on)
                    }
                    showAlsoShowIn={showAlsoShowIn}
                  />
                </>
              )
            }}
          />
          )}
        </>
      )}

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <BulkActionBar
          hiddenCount={hiddenSelectedCount}
          onShowAll={resetView}
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
        sections={sections}
        storyToolsEnabled={storyToolsEnabled}
        neighbors={paintings}
      />

      {/* Edit dialog */}
      {editPainting && (
        <PaintingFormDialog
          open={!!editPainting}
          onOpenChange={(o) => !o && setEditPainting(null)}
          sectionId={section.id}
          painting={editPainting}
          defaultTags={editPainting.tags}
          sections={sections}
          storyToolsEnabled={storyToolsEnabled}
          neighbors={paintings}
        />
      )}
    </div>
  )
}
