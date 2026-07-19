"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { format } from "date-fns"
import { Plus, Pencil, Trash2, ExternalLink, Calendar } from "lucide-react"
import { deleteEvent } from "@/lib/actions/events"
import { ConfirmDialog } from "@/components/admin/confirm-dialog"
import { EmptyState } from "@/components/admin/empty-state"
import { Button } from "@/components/ui/button"
import { EventFormDialog } from "./event-form-dialog"
import type { Event } from "@/lib/types"
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
  initialAddOpen?: boolean
}

export function EventsClient({ current = [], upcoming, past, initialAddOpen = false }: EventsClientProps) {
  const [addOpen, setAddOpen] = useState(initialAddOpen)
  const [editEvent, setEditEvent] = useState<Event | null>(null)
  const router = useRouter()

  useEffect(() => {
    if (initialAddOpen) router.replace("/admin/events")
  }, [initialAddOpen, router])

  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add event
        </Button>
      </div>

      {/* On view now */}
      {current.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs uppercase tracking-[0.2em] font-medium text-amber-700 dark:text-amber-400">
            On View Now
          </h2>
          <div className="space-y-2">
            {current.map((e) => (
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
        {upcoming.length === 0 ? (
          <EmptyState
            icon={Calendar}
            message="No upcoming events."
            action={{ label: "Add event", onClick: () => setAddOpen(true) }}
          />
        ) : (
          <div className="space-y-2">
            {upcoming.map((e) => (
              <EventRow key={e.id} event={e} onEdit={setEditEvent} />
            ))}
          </div>
        )}
      </section>

      {/* Past */}
      {past.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs uppercase tracking-[0.2em] font-medium text-muted-foreground">
            Past
          </h2>
          <div className="space-y-2">
            {past.map((e) => (
              <EventRow key={e.id} event={e} onEdit={setEditEvent} />
            ))}
          </div>
        </section>
      )}

      <EventFormDialog open={addOpen} onOpenChange={setAddOpen} />
      {editEvent && (
        <EventFormDialog
          open={!!editEvent}
          onOpenChange={(o) => !o && setEditEvent(null)}
          event={editEvent}
        />
      )}
    </div>
  )
}
