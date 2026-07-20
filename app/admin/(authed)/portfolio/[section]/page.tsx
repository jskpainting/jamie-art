import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { PageHeader } from "@/components/admin/page-header"
import { getSectionBySlug, getPaintingsWithImagesForSection, getSections } from "@/lib/db/queries"
import { getSchemaCapabilities } from "@/lib/schema-capabilities"
import { PaintingListClient } from "./painting-list-client"

interface Props {
  params: Promise<{ section: string }>
  searchParams: Promise<{ add?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { section } = await params
  return { title: `${section} · Portfolio · Admin · Jamie Kendrioski` }
}

export default async function SectionDetailPage({ params, searchParams }: Props) {
  const [{ section: slug }, sp] = await Promise.all([params, searchParams])

  const section = await getSectionBySlug(slug)
  if (!section) notFound()

  const [paintings, sections, capabilities] = await Promise.all([
    getPaintingsWithImagesForSection(section.id),
    getSections(),
    getSchemaCapabilities(),
  ])

  return (
    <div>
      <PageHeader
        eyebrow="Portfolio"
        title={section.title}
        description={`${paintings.length} painting${paintings.length !== 1 ? "s" : ""} · drag to reorder`}
      />
      <PaintingListClient
        section={section}
        initialPaintings={paintings}
        initialAddOpen={sp.add === "1"}
        sections={sections}
        showAlsoShowIn={capabilities.paintingSections}
      />
    </div>
  )
}
