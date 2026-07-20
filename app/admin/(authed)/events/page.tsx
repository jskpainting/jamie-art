import type { Metadata } from "next"
import { PageHeader } from "@/components/admin/page-header"
import { getCurrentEvents, getUpcomingEvents, getPastEvents } from "@/lib/db/queries"
import { getSchemaCapabilities } from "@/lib/schema-capabilities"
import { EventsClient } from "./events-client"

export const metadata: Metadata = {
  title: "Events · Admin · Jamie Kendrioski",
}

export default async function EventsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ add?: string }>
}) {
  const params = await searchParams
  const [current, upcoming, past, capabilities] = await Promise.all([
    getCurrentEvents(),
    getUpcomingEvents(),
    getPastEvents(),
    getSchemaCapabilities(),
  ])

  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="Events"
        description="Manage upcoming and past shows."
      />
      <EventsClient current={current} upcoming={upcoming} past={past} allowCurrent={capabilities.eventCurrentStatus} initialAddOpen={params.add === "1"} />
    </div>
  )
}
