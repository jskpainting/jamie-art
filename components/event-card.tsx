import { MapPin } from "lucide-react"
import Image from "next/image"
import type { Event } from "@/lib/types"
import type { EventBucket } from "@/lib/event-bucket"
import { cn, formatEventDateRange } from "@/lib/utils"
import { focalObjectPosition } from "@/lib/focal"

function normalizeUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) return url
  return `https://${url}`
}

function mapsUrl(location: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`
}

interface EventCardProps {
  event: Event
  /** Which bucket this card is rendered in. Falls back to the event's status. */
  variant?: EventBucket
}

export function EventCard({ event, variant }: EventCardProps) {
  const resolved: EventBucket =
    variant ??
    (event.status === "current"
      ? "current"
      : event.status === "past"
        ? "past"
        : "upcoming")
  const isPast = resolved === "past"
  const isCurrent = resolved === "current"
  const showLink = !isPast

  return (
    <div
      className={cn(
        "border p-6",
        isCurrent
          ? "border-accent bg-card ring-1 ring-accent/40"
          : isPast
            ? "border-border/50 bg-muted/30 opacity-80"
            : "border-border bg-card"
      )}
    >
      {isCurrent && (
        <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] font-medium text-accent mb-3">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-60 motion-safe:animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
          </span>
          On View Now
        </p>
      )}

      {event.image_url && (
        <div className="relative w-full aspect-video overflow-hidden bg-muted mb-4 -mx-6 -mt-6 w-[calc(100%+3rem)]">
          <Image
            src={event.image_url}
            alt={event.title}
            fill
            className="object-cover"
            style={focalObjectPosition(event.image_focal_x, event.image_focal_y)}
            sizes="(min-width: 768px) 50vw, 100vw"
            quality={90}
          />
        </div>
      )}

      <p className="text-xs uppercase tracking-[0.2em] font-medium text-muted-foreground mb-2">
        {formatEventDateRange(event.starts_at, event.ends_at)}
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

      {event.link && showLink && (
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
