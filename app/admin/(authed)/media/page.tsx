import type { Metadata } from "next"
import { PageHeader } from "@/components/admin/page-header"
import { MediaLibraryClient } from "./media-library-client"

export const metadata: Metadata = {
  title: "Images · Admin · Jamie Kendrioski",
  robots: { index: false },
}

export default function MediaLibraryPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="Images"
        description="Every photo you've uploaded. Reuse one anywhere, or delete what you don't need."
      />
      <MediaLibraryClient />
    </div>
  )
}
