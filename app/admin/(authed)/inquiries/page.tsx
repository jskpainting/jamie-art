import type { Metadata } from "next"
import { PageHeader } from "@/components/admin/page-header"
import {
  getInquiriesWithPainting,
  getInquiriesStats,
  getAllCommissionInquiries,
  getCommissionInquiriesStats,
} from "@/lib/db/queries"
import { InquiriesClient } from "./inquiries-client"

export const metadata: Metadata = {
  title: "Inquiries · Admin · Jamie Kendrioski",
}

export default async function InquiriesAdminPage() {
  const [inquiries, stats, commissions, commissionStats] = await Promise.all([
    getInquiriesWithPainting(),
    getInquiriesStats(),
    getAllCommissionInquiries(),
    getCommissionInquiriesStats(),
  ])

  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="Inquiries"
        description="Messages from visitors interested in paintings and commissions."
      />
      <InquiriesClient
        inquiries={inquiries}
        stats={stats}
        commissions={commissions}
        commissionStats={commissionStats}
      />
    </div>
  )
}
