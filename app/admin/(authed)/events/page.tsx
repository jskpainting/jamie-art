import type { Metadata } from "next"
import { PageHeader } from "@/components/admin/page-header"
import { ComingSoonCard } from "@/components/admin/coming-soon-card"

export const metadata: Metadata = {
  title: "Events · Admin · Jamie Kendrioski",
}

export default function EventsAdminPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Events"
        title="Events"
        description="Manage upcoming and past shows."
      />
      <ComingSoonCard description="Phase 4 adds events CRUD — create shows, set dates and locations, add links, and mark events as past or cancelled." />
    </div>
  )
}
