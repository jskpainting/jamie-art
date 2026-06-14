import { format, parseISO } from "date-fns"
import { MapPin } from "lucide-react"
import Image from "next/image"
import type { Event } from "@/lib/types"
import { cn } from "@/lib/utils"

function normalizeUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) return url
  return `https://${url}`
}

function mapsUrl(location: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`
}

interface EventCardProps {
  event: Event
}

export function EventCard({ event }: EventCardProps) {
  const isUpcoming = event.status === "upcoming"
  const startDate = parseISO(event.starts_at)

  return (
    <div
      className={cn(
        "border p-6",
        isUpcoming
          ? "border-border bg-card"
          : "border-border/50 bg-muted/30 opacity-80"
      )}
    >
      {event.image_url && (
        <div className="relative w-full aspect-video overflow-hidden bg-muted mb-4 -mx-6 -mt-6 w-[calc(100%+3rem)]">
          <Image
            src={event.image_url}
            alt={event.title}
            fill
            className="object-cover"
            sizes="(min-width: 768px) 50vw, 100vw"
            quality={90}
          />
        </div>
      )}

      <p className="text-xs uppercase tracking-[0.2em] font-medium text-muted-foreground mb-2">
        {format(startDate, "MMMM d, yyyy")}
        {event.ends_at && ` — ${format(parseISO(event.ends_at), "MMMM d, yyyy")}`}
      </p>

      <h3 className="text-xl md:text-2xl font-serif font-light tracking-tight mb-2">
        {event.title}
      </h3>

      {event.location && (
        <a
          href={mapsUrl(event.location)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-3 hover:underline underline-offset-4 transition-colors"
        >
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          {event.location}
        </a>
      )}

      {event.description && (
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
          {event.description}
        </p>
      )}

      {event.link && isUpcoming && (
        <a
          href={normalizeUrl(event.link)}
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
