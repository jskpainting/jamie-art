import type { Metadata } from "next"
import { PageHeader } from "@/components/admin/page-header"
import { ComingSoonCard } from "@/components/admin/coming-soon-card"

export const metadata: Metadata = {
  title: "Contacts · Admin · Jamie Kendrioski",
}

export default function ContactsAdminPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Contacts"
        title="Contacts"
        description="Mailing list and newsletter subscribers."
      />
      <ComingSoonCard description="Phase 4 adds a contacts list with CSV/Excel import (papaparse), deduplication by email, and tag management." />
    </div>
  )
}
