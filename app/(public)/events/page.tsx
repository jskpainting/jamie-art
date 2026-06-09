import type { Metadata } from "next"
import { EventCard } from "@/components/event-card"
import { EmptyState } from "@/components/empty-state"
import { getUpcomingEvents, getPastEvents } from "@/lib/db/queries"

export const metadata: Metadata = {
  title: "Events",
  description: "Upcoming and past shows featuring work by Jamie Kendrioski.",
}

export default async function EventsPage() {
  const [upcoming, past] = await Promise.all([
    getUpcomingEvents(),
    getPastEvents(),
  ])

  return (
    <div className="max-w-7xl mx-auto px-6 md:px-10 py-20 md:py-32">
      <p className="text-xs uppercase tracking-[0.2em] font-medium text-muted-foreground mb-3">
        Events
      </p>
      <h1 className="text-3xl md:text-5xl tracking-tight font-light font-serif mb-12 md:mb-16">
        Shows &amp; Openings
      </h1>

      {upcoming.length === 0 && past.length === 0 ? (
        <EmptyState
          title="No events scheduled"
          description="Sign up for the mailing list in the footer to be notified when shows are announced."
        />
      ) : (
        <div className="space-y-16">
          {upcoming.length > 0 && (
            <section>
              <h2 className="text-xs uppercase tracking-[0.2em] font-medium text-muted-foreground mb-6">
                Upcoming
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                {upcoming.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            </section>
          )}

          {past.length > 0 && (
            <section>
              <h2 className="text-xs uppercase tracking-[0.2em] font-medium text-muted-foreground mb-6">
                Past
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                {past.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
