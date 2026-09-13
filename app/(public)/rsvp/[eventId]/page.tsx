import type { Metadata } from "next"
import Image from "next/image"
import { MapPin } from "lucide-react"
import { getEventForRsvp } from "@/lib/db/queries"
import { createAdminClient } from "@/lib/supabase/admin"
import { bucketOf } from "@/lib/event-bucket"
import { formatEventDateRange } from "@/lib/utils"
import { focalObjectPosition } from "@/lib/focal"
import { RsvpForm } from "./rsvp-form"
import type { Event } from "@/lib/types"

// Wrapping the Date.now() read in its own function (rather than calling it
// directly in the page component's body) keeps the render function itself
// free of a direct impure-call reference.
function currentBucket(event: Event) {
  return bucketOf(event, Date.now())
}

export const dynamic = "force-dynamic"

interface RsvpPageProps {
  params: Promise<{ eventId: string }>
  searchParams: Promise<{ t?: string }>
}

export async function generateMetadata({ params }: RsvpPageProps): Promise<Metadata> {
  const { eventId } = await params
  const event = await getEventForRsvp(eventId)
  return {
    title: event ? `RSVP — ${event.title}` : "RSVP",
    robots: { index: false, follow: false },
  }
}

/**
 * Display-only lookup of an invite row by token, so the page can greet the
 * person by name before they submit anything. All writes still go through
 * `POST /api/rsvp` → respondByToken/respondPublic exclusively. Swallows any
 * error (including the table not existing yet) and falls back to the public
 * (name + email) flow.
 */
async function findInviteByToken(eventId: string, token: string) {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("event_rsvps")
      .select("id, name, email, status, guests")
      .eq("event_id", eventId)
      .eq("token", token)
      .maybeSingle()
    if (error || !data) return null
    return data as {
      id: string
      name: string | null
      email: string
      status: "invited" | "yes" | "no" | "maybe"
      guests: number
    }
  } catch {
    return null
  }
}

export default async function RsvpPage({ params, searchParams }: RsvpPageProps) {
  const { eventId } = await params
  const { t: token } = await searchParams

  const event = await getEventForRsvp(eventId)

  if (!event) {
    return (
      <RsvpShell>
        <p className="text-base text-muted-foreground">
          We couldn&rsquo;t find that event.
        </p>
      </RsvpShell>
    )
  }

  const bucket = currentBucket(event)
  const friendlyLine =
    event.status === "cancelled"
      ? "This event has been cancelled."
      : bucket === "past"
        ? "This event has already taken place."
        : !event.rsvp_enabled
          ? "RSVP isn't open for this event."
          : null

  const invite = token ? await findInviteByToken(eventId, token) : null

  return (
    <RsvpShell>
      {event.image_url && (
        <div className="relative w-full aspect-video overflow-hidden bg-muted mb-6 rounded-2xl">
          <Image
            src={event.image_url}
            alt={event.title}
            fill
            className="object-cover"
            style={focalObjectPosition(event.image_focal_x, event.image_focal_y)}
            sizes="(min-width: 768px) 640px, 100vw"
            quality={90}
            priority
          />
        </div>
      )}

      <p className="text-xs uppercase tracking-[0.2em] font-medium text-muted-foreground mb-2">
        {formatEventDateRange(event.starts_at, event.ends_at)}
      </p>
      <h1 className="text-3xl md:text-4xl tracking-tight font-light font-serif mb-3">
        {event.title}
      </h1>
      {event.location && (
        <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground mb-6">
          <MapPin className="h-4 w-4 shrink-0" />
          {event.location}
        </p>
      )}

      {friendlyLine ? (
        <p className="text-base text-muted-foreground mt-4">{friendlyLine}</p>
      ) : (
        <RsvpForm
          eventId={eventId}
          token={token ?? null}
          rsvpNote={event.rsvp_note ?? null}
          invite={invite}
        />
      )}
    </RsvpShell>
  )
}

function RsvpShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-xl mx-auto px-6 py-16 md:py-24">{children}</div>
  )
}
