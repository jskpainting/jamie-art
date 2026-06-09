import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { PageHeader } from "@/components/admin/page-header"
import { getSectionBySlug, getPaintingsWithImagesForSection } from "@/lib/db/queries"
import { PaintingListClient } from "./painting-list-client"

const VALID_SLUGS = [
  "abstracts",
  "cityscapes-seascapes",
  "florals",
  "pixels-rainbows",
]

interface Props {
  params: Promise<{ section: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { section } = await params
  return { title: `${section} · Portfolio · Admin · Jamie Kendrioski` }
}

export default async function SectionDetailPage({ params }: Props) {
  const { section: slug } = await params

  if (!VALID_SLUGS.includes(slug)) notFound()

  const section = await getSectionBySlug(slug)
  if (!section) notFound()

  const paintings = await getPaintingsWithImagesForSection(section.id)

  return (
    <div>
      <PageHeader
        eyebrow="Portfolio"
        title={section.title}
        description={`${paintings.length} painting${paintings.length !== 1 ? "s" : ""} · drag to reorder`}
      />
      <PaintingListClient section={section} initialPaintings={paintings} />
    </div>
  )
}
