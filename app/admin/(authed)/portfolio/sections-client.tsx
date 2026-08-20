"use client"

import { useState, useMemo, useCallback, useOptimistic, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import Image from "next/image"
import { Plus, Pencil, Trash2, ImageIcon, GripVertical } from "lucide-react"
import { reorderSections, deleteSection } from "@/lib/actions/sections"
import { SortableList } from "@/components/admin/sortable-list"
import { ConfirmDialog } from "@/components/admin/confirm-dialog"
import { SectionFormDialog } from "@/components/admin/section-form-dialog"
import { ListToolbar, FilteredEmptyState } from "@/components/admin/list-toolbar"
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

type FilterKey = "all" | "has" | "empty"
type SortKey = "owner" | "title" | "most" | "fewest"

const FILTER_OPTIONS = [
  { value: "all", label: "All galleries" },
  { value: "has", label: "With paintings" },
  { value: "empty", label: "Empty" },
]

const SORT_OPTIONS = [
  { value: "owner", label: "My order (drag to rearrange)" },
  { value: "title", label: "Name A–Z" },
  { value: "most", label: "Most paintings first" },
  { value: "fewest", label: "Fewest paintings first" },
]

/**
 * Same footprint as the real drag handle so nothing shifts when dragging is
 * switched off, but visibly inert.
 */
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

export function SectionsClient({ initialSections, showFocal }: SectionsClientProps) {
  const [sections, setOptimistic] = useOptimistic(initialSections)
  const [, startTransition] = useTransition()
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)
  const [editSection, setEditSection] = useState<SectionWithCount | null>(null)

  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<FilterKey>("all")
  const [sort, setSort] = useState<SortKey>("owner")

  // Dragging writes sort_order for exactly the rows it is handed, so it is only
  // safe while every row is on screen in the owner's own order. Any search,
  // filter or sort turns it off — and the owner's real order is never touched.
  const isOwnerView = sort === "owner" && filter === "all" && search.trim() === ""

  const resetView = useCallback(() => {
    setSearch("")
    setFilter("all")
    setSort("owner")
  }, [])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    let rows = sections.filter((s) => {
      if (filter === "has" && s.painting_count === 0) return false
      if (filter === "empty" && s.painting_count !== 0) return false
      if (!q) return true
      return (
        s.title.toLowerCase().includes(q) || s.slug.toLowerCase().includes(q)
      )
    })
    if (sort === "title") {
      rows = [...rows].sort((a, b) => a.title.localeCompare(b.title))
    } else if (sort === "most") {
      rows = [...rows].sort((a, b) => b.painting_count - a.painting_count)
    } else if (sort === "fewest") {
      rows = [...rows].sort((a, b) => a.painting_count - b.painting_count)
    }
    return rows
  }, [sections, search, filter, sort])

  function handleLocalReorder(newIds: string[]) {
    // Belt-and-braces: a reorder computed from anything other than the full
    // owner-ordered list would renumber a subset and scramble the live site.
    if (!isOwnerView || newIds.length !== sections.length) return
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

  const renderRow = (section: SectionWithCount, handle: React.ReactNode) => {
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
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add section
        </Button>
      </div>

      <ListToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name…"
        searchLabel="Search galleries"
        filterValue={filter}
        onFilterChange={(v) => setFilter(v as FilterKey)}
        filterOptions={FILTER_OPTIONS}
        filterLabel="Show only"
        sortValue={sort}
        onSortChange={(v) => setSort(v as SortKey)}
        sortOptions={SORT_OPTIONS}
        sortLabel="Order this list by"
        resultCount={visible.length}
        totalCount={sections.length}
        itemNoun="galleries"
        hasActiveFilters={!isOwnerView}
        onClear={resetView}
      />

      {!isOwnerView && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-dashed border-border px-3 py-2">
          <p className="text-xs text-muted-foreground">
            You&rsquo;re viewing these a different way, so dragging is switched
            off. Your website still shows your own order — nothing has changed.
          </p>
          <Button size="sm" variant="outline" onClick={resetView}>
            Back to my order
          </Button>
        </div>
      )}

      {sections.length > 0 && visible.length === 0 ? (
        <FilteredEmptyState query={search} itemNoun="galleries" onClear={resetView} />
      ) : isOwnerView ? (
        <SortableList
          items={visible}
          onReorder={handleLocalReorder}
          renderItem={renderRow}
        />
      ) : (
        <div className="space-y-2">
          {visible.map((section) => (
            <div key={section.id}>{renderRow(section, <LockedHandle />)}</div>
          ))}
        </div>
      )}

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
