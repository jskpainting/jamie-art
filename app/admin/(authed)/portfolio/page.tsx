import type { Metadata } from "next"
import { PageHeader } from "@/components/admin/page-header"
import { ComingSoonCard } from "@/components/admin/coming-soon-card"

export const metadata: Metadata = {
  title: "Portfolio · Admin · Jamie Kendrioski",
}

export default function PortfolioAdminPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Portfolio"
        title="Portfolio"
        description="Manage paintings across all sections."
      />
      <ComingSoonCard description="Phase 4 adds paintings CRUD inside each section — create, edit, reorder (drag-and-drop), upload images, and set status." />
    </div>
  )
}
