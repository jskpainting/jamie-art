import type { Metadata } from "next"
import { PageHeader } from "@/components/admin/page-header"
import { getSections } from "@/lib/db/queries"
import { SectionsClient } from "./sections-client"

export const metadata: Metadata = {
  title: "Portfolio · Admin · Jamie Kendrioski",
}

export default async function PortfolioAdminPage() {
  const sections = await getSections()

  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="Portfolio"
        description="Manage paintings across all sections."
      />
      <SectionsClient initialSections={sections} />
    </div>
  )
}
