import type { Metadata } from "next"
import { PageHeader } from "@/components/admin/page-header"
import { getBio } from "@/lib/db/queries"
import { BioForm } from "./bio-form"

export const metadata: Metadata = {
  title: "Bio · Admin · Jamie Kendrioski",
}

export default async function BioPage() {
  const bio = await getBio()

  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="Bio"
        description="Edit your biography, statement, and headshot."
      />
      <BioForm bio={bio} />
    </div>
  )
}
