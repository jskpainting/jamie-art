"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { format } from "date-fns"
import { Plus, Pencil, Trash2, ExternalLink, Calendar } from "lucide-react"
import { deleteEvent } from "@/lib/actions/events"
import { ConfirmDialog } from "@/components/admin/confirm-dialog"
import { EmptyState } from "@/components/admin/empty-state"
import { ListToolbar, FilteredEmptyState } from "@/components/admin/list-toolbar"
import { Button } from "@/components/ui/button"
import { EventFormDialog } from "./event-form-dialog"
import type { Event, EventStatus } from "@/lib/types"
import { cn } from "@/lib/utils"

const STATUS_COLORS: Record<string, string> = {
  current: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  upcoming: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  past: "bg-muted text-muted-foreground",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
}

const STATUS_LABELS: Record<string, string> = {
  current: "on view now",
  upcoming: "upcoming",
  past: "past",
  cancelled: "cancelled",
}

function EventRow({
  event,
  onEdit,
}: {
  event: Event
  onEdit: (e: Event) => void
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium min-w-0 truncate">{event.title}</p>
          <span
            className={cn(
              "text-xs px-2 py-0.5 rounded-full font-medium shrink-0",
              STATUS_COLORS[event.status] ?? ""
            )}
          >
            {STATUS_LABELS[event.status] ?? event.status}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {format(new Date(event.starts_at), "MMM d, yyyy")}
          {event.ends_at &&
            ` — ${format(new Date(event.ends_at), "MMM d, yyyy")}`}
          {event.location ? ` · ${event.location}` : ""}
        </p>
        {event.link && (
          <a
            href={event.link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            {event.link}
          </a>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-foreground/60 hover:text-foreground"
          onClick={() => onEdit(event)}
          aria-label="Edit event"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <ConfirmDialog
          trigger={
            <Button variant="ghost" size="icon-sm" aria-label="Delete event">
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          }
          title="Delete event"
          description={`"${event.title}" will be permanently deleted.`}
          destructive
          onConfirm={async () => {
            const result = await deleteEvent(event.id)
            if (!result.ok) throw new Error(result.error)
            toast.success("Event deleted")
          }}
        />
      </div>
    </div>
  )
}

interface EventsClientProps {
  current?: Event[]
  upcoming: Event[]
  past: Event[]
  allowCurrent?: boolean
  showFocal?: boolean
  initialAddOpen?: boolean
}

type StatusFilter = "all" | EventStatus
type SortKey = "soonest" | "latest"

function buildSortOptions(): { value: string; label: string }[] {
  return [
    { value: "soonest", label: "Date, soonest first" },
    { value: "latest", label: "Date, latest first" },
  ]
}

export function EventsClient({ current = [], upcoming, past, allowCurrent = false, showFocal = false, initialAddOpen = false }: EventsClientProps) {
  const [addOpen, setAddOpen] = useState(initialAddOpen)
  const [editEvent, setEditEvent] = useState<Event | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [sort, setSort] = useState<SortKey>("soonest")
  const router = useRouter()

  useEffect(() => {
    if (initialAddOpen) router.replace("/admin/events")
  }, [initialAddOpen, router])

  const all = useMemo(() => [...current, ...upcoming, ...past], [current, upcoming, past])
  const total = all.length
  const hasActiveFilters = search.trim().length > 0 || statusFilter !== "all"

  function clearFilters() {
    setSearch("")
    setStatusFilter("all")
  }

  const filterAndSort = useCallback(
    (list: Event[]) => {
      const q = search.trim().toLowerCase()
      const result = list.filter((e) => {
        if (statusFilter !== "all" && e.status !== statusFilter) return false
        if (!q) return true
        return (
          e.title.toLowerCase().includes(q) ||
          (e.location ?? "").toLowerCase().includes(q)
        )
      })
      result.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
      return sort === "soonest" ? result : result.reverse()
    },
    [search, statusFilter, sort]
  )

  const filteredCurrent = useMemo(() => filterAndSort(current), [current, filterAndSort])
  const filteredUpcoming = useMemo(() => filterAndSort(upcoming), [upcoming, filterAndSort])
  const filteredPast = useMemo(() => filterAndSort(past), [past, filterAndSort])
  const visibleCount = filteredCurrent.length + filteredUpcoming.length + filteredPast.length

  const statusFilterOptions = useMemo(() => {
    const opts = [{ value: "all", label: "All statuses" }]
    if (allowCurrent) opts.push({ value: "current", label: "On view now" })
    opts.push({ value: "upcoming", label: "Upcoming" })
    opts.push({ value: "past", label: "Past" })
    opts.push({ value: "cancelled", label: "Cancelled" })
    return opts
  }, [allowCurrent])

  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add event
        </Button>
      </div>

      <ListToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search title or location…"
        searchLabel="Search events"
        filterValue={statusFilter}
        onFilterChange={(v) => setStatusFilter(v as StatusFilter)}
        filterOptions={statusFilterOptions}
        filterLabel="Filter by status"
        sortValue={sort}
        onSortChange={(v) => setSort(v as SortKey)}
        sortOptions={buildSortOptions()}
        sortLabel="Sort events"
        resultCount={visibleCount}
        totalCount={total}
        itemNoun="events"
        hasActiveFilters={hasActiveFilters}
        onClear={clearFilters}
      />

      {total > 0 && visibleCount === 0 ? (
        <FilteredEmptyState query={search} itemNoun="events" onClear={clearFilters} />
      ) : (
        <>
          {/* On view now */}
          {filteredCurrent.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs uppercase tracking-[0.2em] font-medium text-amber-700 dark:text-amber-400">
                On View Now
              </h2>
              <div className="space-y-2">
                {filteredCurrent.map((e) => (
                  <EventRow key={e.id} event={e} onEdit={setEditEvent} />
                ))}
              </div>
            </section>
          )}

          {/* Upcoming */}
          <section className="space-y-3">
            <h2 className="text-xs uppercase tracking-[0.2em] font-medium text-muted-foreground">
              Upcoming
            </h2>
            {filteredUpcoming.length === 0 ? (
              total === 0 ? (
                <EmptyState
                  icon={Calendar}
                  message="No upcoming events."
                  action={{ label: "Add event", onClick: () => setAddOpen(true) }}
                />
              ) : null
            ) : (
              <div className="space-y-2">
                {filteredUpcoming.map((e) => (
                  <EventRow key={e.id} event={e} onEdit={setEditEvent} />
                ))}
              </div>
            )}
          </section>

          {/* Past */}
          {filteredPast.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs uppercase tracking-[0.2em] font-medium text-muted-foreground">
                Past
              </h2>
              <div className="space-y-2">
                {filteredPast.map((e) => (
                  <EventRow key={e.id} event={e} onEdit={setEditEvent} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <EventFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        allowCurrent={allowCurrent}
        showFocal={showFocal}
      />
      {editEvent && (
        <EventFormDialog
          open={!!editEvent}
          onOpenChange={(o) => !o && setEditEvent(null)}
          event={editEvent}
          allowCurrent={allowCurrent}
          showFocal={showFocal}
        />
      )}
    </div>
  )
}
