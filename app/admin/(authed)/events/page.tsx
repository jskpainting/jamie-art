import type { Metadata } from "next"
import { PageHeader } from "@/components/admin/page-header"
import { getCurrentEvents, getUpcomingEvents, getPastEvents } from "@/lib/db/queries"
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
  const [current, upcoming, past] = await Promise.all([
    getCurrentEvents(),
    getUpcomingEvents(),
    getPastEvents(),
  ])

  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="Events"
        description="Manage upcoming and past shows."
      />
      <EventsClient current={current} upcoming={upcoming} past={past} initialAddOpen={params.add === "1"} />
    </div>
  )
}
