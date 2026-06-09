import type { Metadata } from "next"
import { PageHeader } from "@/components/admin/page-header"
import { ComingSoonCard } from "@/components/admin/coming-soon-card"

export const metadata: Metadata = {
  title: "Bio · Admin · Jamie Kendrioski",
}

export default function BioPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Bio"
        title="Bio"
        description="Edit your biography, statement, and headshot."
      />
      <ComingSoonCard description="Phase 4 adds a markdown editor for your biography and statement, plus headshot upload to Supabase Storage." />
    </div>
  )
}
