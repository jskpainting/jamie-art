import type { Metadata } from "next"
import { PageHeader } from "@/components/admin/page-header"
import { getInquiriesWithPainting, getInquiriesStats } from "@/lib/db/queries"
import { InquiriesClient } from "./inquiries-client"

export const metadata: Metadata = {
  title: "Inquiries · Admin · Jamie Kendrioski",
}

export default async function InquiriesAdminPage() {
  const [inquiries, stats] = await Promise.all([
    getInquiriesWithPainting(),
    getInquiriesStats(),
  ])

  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="Inquiries"
        description="Messages from visitors interested in paintings."
      />
      <InquiriesClient inquiries={inquiries} stats={stats} />
    </div>
  )
}
