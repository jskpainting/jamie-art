import { format, parseISO } from "date-fns"
import type { Event } from "@/lib/types"
import { cn } from "@/lib/utils"

interface EventCardProps {
  event: Event
}

export function EventCard({ event }: EventCardProps) {
  const isUpcoming = event.status === "upcoming"
  const startDate = parseISO(event.starts_at)

  return (
    <div
      className={cn(
        "rounded-2xl border p-6",
        isUpcoming
          ? "border-border bg-card"
          : "border-border/50 bg-muted/30 opacity-80"
      )}
    >
      <p className="text-xs uppercase tracking-[0.2em] font-medium text-muted-foreground mb-2">
        {format(startDate, "MMMM d, yyyy")}
        {event.ends_at && ` — ${format(parseISO(event.ends_at), "MMMM d, yyyy")}`}
      </p>

      <h3 className="text-xl md:text-2xl font-serif font-light tracking-tight mb-2">
        {event.title}
      </h3>

      {event.location && (
        <p className="text-sm text-muted-foreground mb-3">{event.location}</p>
      )}

      {event.description && (
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
          {event.description}
        </p>
      )}

      {event.link && isUpcoming && (
        <a
          href={event.link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm font-medium text-foreground hover:underline underline-offset-4 transition-colors"
        >
          More info →
        </a>
      )}
    </div>
  )
}
