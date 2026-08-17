import { PageHeader } from "@/components/admin/page-header"
import { getSectionBySlug, getPaintingsBySection, getSettings } from "@/lib/db/queries"
import { getSchemaCapabilities } from "@/lib/schema-capabilities"
import { LayoutPreviewClient } from "./layout-preview-client"

export const metadata = {
  title: "Gallery Layout",
}

export default async function LayoutPreviewPage() {
  const [section, settings, capabilities] = await Promise.all([
    getSectionBySlug("abstracts"),
    getSettings(),
    getSchemaCapabilities(),
  ])
  const paintings = section ? await getPaintingsBySection(section.id) : []

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Design"
        title="Gallery layout"
        description="Preview how your portfolio wall can be arranged, then make one live."
      />
      {paintings.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No paintings found in the Abstracts section.
        </p>
      ) : (
        <LayoutPreviewClient
          paintings={paintings}
          activeLayout={settings?.active_layout ?? "pairs"}
          canActivate={capabilities.activeLayout}
        />
      )}
    </div>
  )
}
