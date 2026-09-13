import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { PageHeader } from "@/components/admin/page-header"
import { getEventForRsvp } from "@/lib/db/queries"
import { getEventRsvps } from "@/lib/actions/rsvp"
import { RsvpsClient } from "./rsvps-client"
import type { EventRsvp } from "@/lib/types"

export const metadata: Metadata = {
  title: "RSVPs · Admin · Jamie Kendrioski",
}

export default async function EventRsvpsAdminPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const event = await getEventForRsvp(id)
  if (!event) notFound()

  const result = await getEventRsvps(id)
  const rsvps = (result.ok ? result.rsvps : []) as EventRsvp[]

  return (
    <div>
      <Link
        href="/admin/events"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to events
      </Link>
      <PageHeader
        eyebrow="RSVPs"
        title={event.title}
        description={`${rsvps.length} response${rsvps.length === 1 ? "" : "s"} so far.`}
      />
      <RsvpsClient eventId={id} initialRsvps={rsvps} />
    </div>
  )
}
