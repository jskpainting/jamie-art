import { getSampleImages } from "@/lib/layout-samples"
import { PageHeader } from "@/components/admin/page-header"
import { LayoutPreviewClient } from "./layout-preview-client"

export const metadata = {
  title: "Layout Preview",
}

export default async function LayoutPreviewPage() {
  const images = await getSampleImages()

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Dev"
        title="Layout Preview"
        description="Compare gallery layouts using the sample image set. Temporary dev tool."
      />
      {images.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No sample images found. Drop image files into{" "}
          <code className="font-mono">sample_images/</code> at the repo root and
          restart the dev server.
        </p>
      ) : (
        <LayoutPreviewClient images={images} />
      )}
    </div>
  )
}
