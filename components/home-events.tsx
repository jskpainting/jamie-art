"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { MapPin } from "lucide-react"
import type { Event } from "@/lib/types"
import { bucketOf } from "@/lib/event-bucket"

interface HomeEventsProps {
  events: Event[]
}

function formatDateRange(startsAt: string, endsAt: string | null): string {
  const start = new Date(startsAt)
  const full = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
  if (!endsAt) return full.format(start)
  const end = new Date(endsAt)
  const monthDay = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" })
  const sameYear = start.getFullYear() === end.getFullYear()
  const sameMonth = sameYear && start.getMonth() === end.getMonth()
  // Same month: "September 24 – 27, 2026"
  if (sameMonth) {
    return `${monthDay.format(start)} – ${end.getDate()}, ${end.getFullYear()}`
  }
  // Same year, different month: "September 30 – October 3, 2026"
  if (sameYear) {
    return `${monthDay.format(start)} – ${full.format(end)}`
  }
  return `${full.format(start)} – ${full.format(end)}`
}

interface EventCardProps {
  event: Event
}

function EventCard({ event }: EventCardProps) {
  return (
    <div className="flex gap-4 items-start">
      {event.image_url && (
        <div className="relative w-16 h-16 shrink-0 overflow-hidden">
          <Image
            src={event.image_url}
            alt={event.title}
            fill
            sizes="64px"
            className="object-cover"
          />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-[0.2em] font-medium text-muted-foreground mb-1">
          {formatDateRange(event.starts_at, event.ends_at)}
        </p>
        <h3 className="text-xl font-medium leading-snug mb-0.5">{event.title}</h3>
        {event.location && (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline underline-offset-4 transition-colors"
          >
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            {event.location}
          </a>
        )}
      </div>
    </div>
  )
}

export function HomeEvents({ events }: HomeEventsProps) {
  // Pass Date.now as a lazy initializer (not called in render body) — client-side time only
  const [now] = useState<number>(Date.now)

  // Bucket with the shared helper so a manually-marked "current" show is
  // treated as active even when its dates don't span today.
  const active = events.filter((e) => bucketOf(e, now) === "current")
  const upcoming = events.filter((e) => bucketOf(e, now) === "upcoming")
  const past = events.filter((e) => bucketOf(e, now) === "past").reverse()

  if (active.length === 0 && upcoming.length === 0 && past.length === 0) return null

  const firstActive = active[0]
  const upcomingToShow = upcoming.slice(0, active.length > 0 ? 3 : 3)
  const pastToShow = past.slice(0, 3)

  return (
    <section className="max-w-7xl mx-auto px-6 md:px-10 py-16 md:py-24 border-t border-border">
      <div className="grid md:grid-cols-[1fr_auto] gap-6 items-baseline mb-10">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] font-medium text-muted-foreground mb-2">
            {active.length > 0 ? "On Now" : upcoming.length > 0 ? "Upcoming" : "Recent"}
          </p>
          <h2 className="text-3xl md:text-5xl tracking-tight font-light font-serif">
            {active.length > 0
              ? "Events"
              : upcoming.length > 0
              ? "Upcoming Events"
              : "Past Events"}
          </h2>
        </div>
        <Link
          href="/events"
          className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
        >
          View all events →
        </Link>
      </div>

      <div className="space-y-8">
        {/* Happening Now banner */}
        {firstActive && (
          <div className="border-l-4 border-accent pl-5 py-1">
            <p className="text-xs uppercase tracking-[0.2em] font-medium text-accent mb-3">
              Happening Now
            </p>
            <EventCard event={firstActive} />
          </div>
        )}

        {/* Upcoming list */}
        {upcomingToShow.length > 0 && (
          <div className="space-y-6">
            {active.length > 0 && (
              <p className="text-xs uppercase tracking-[0.2em] font-medium text-muted-foreground">
                Upcoming
              </p>
            )}
            {upcomingToShow.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        )}

        {/* Past list (only when no active/upcoming) */}
        {active.length === 0 && upcoming.length === 0 && pastToShow.length > 0 && (
          <div className="space-y-6 opacity-70">
            {pastToShow.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
