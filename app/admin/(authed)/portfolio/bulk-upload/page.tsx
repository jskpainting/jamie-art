import type { Metadata } from "next"
import { getSections } from "@/lib/db/queries"
import { PageHeader } from "@/components/admin/page-header"
import { BulkUploadClient } from "./bulk-upload-client"

export const metadata: Metadata = {
  title: "Bulk Upload · Portfolio · Admin · Jamie Kendrioski",
}

interface Props {
  searchParams: Promise<{ section?: string }>
}

export default async function BulkUploadPage({ searchParams }: Props) {
  const [sp, sections] = await Promise.all([searchParams, getSections()])

  // Default to the gallery the owner came from, else the first real gallery.
  // (The old fallback was the hidden "uncategorized" bucket, which the owner
  // has since renamed into a real gallery — so it is no longer a sensible
  // place to drop new work by default.)
  const defaultSection =
    sections.find((s) => s.slug === sp.section) ??
    sections.find((s) => s.slug !== "uncategorized") ??
    sections[0]

  return (
    <div>
      <PageHeader
        eyebrow="Portfolio"
        title="Bulk upload"
        description="Drop images to upload them all at once, then save to the portfolio."
      />
      <BulkUploadClient
        sections={sections}
        defaultSectionId={defaultSection?.id ?? ""}
      />
    </div>
  )
}
