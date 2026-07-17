import { PageHeader } from "@/components/admin/page-header"
import { getSectionBySlug, getPaintingsBySection } from "@/lib/db/queries"
import { LayoutPreviewClient } from "./layout-preview-client"

export const metadata = {
  title: "Layout Preview",
}

export default async function LayoutPreviewPage() {
  const section = await getSectionBySlug("abstracts")
  const paintings = section ? await getPaintingsBySection(section.id) : []

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Dev"
        title="Layout Preview"
        description="Compare gallery layouts using your real Abstracts paintings. Pick one to ship across the site."
      />
      {paintings.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No paintings found in the Abstracts section.
        </p>
      ) : (
        <LayoutPreviewClient paintings={paintings} />
      )}
    </div>
  )
}
