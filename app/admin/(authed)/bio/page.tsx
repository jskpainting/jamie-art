import type { Metadata } from "next"
import { PageHeader } from "@/components/admin/page-header"
import { getBio } from "@/lib/db/queries"
import { getSchemaCapabilities } from "@/lib/schema-capabilities"
import { BioForm } from "./bio-form"

export const metadata: Metadata = {
  title: "Bio · Admin · Jamie Kendrioski",
}

export default async function BioPage() {
  const [bio, capabilities] = await Promise.all([getBio(), getSchemaCapabilities()])

  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="Bio"
        description="Edit your biography, statement, and headshot."
      />
      <BioForm bio={bio} showFocal={capabilities.focalPoints} />
    </div>
  )
}
