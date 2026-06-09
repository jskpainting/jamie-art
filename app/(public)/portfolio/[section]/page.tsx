import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { SectionGallery } from "@/components/section-gallery"
import { getSectionBySlug, getPaintingsBySection } from "@/lib/db/queries"

type Props = {
  params: Promise<{ section: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { section } = await params
  const data = await getSectionBySlug(section)
  if (!data) return { title: "Not Found" }
  return {
    title: data.title,
    description: data.description ?? undefined,
  }
}

export default async function SectionPage({ params }: Props) {
  const { section: sectionSlug } = await params
  const section = await getSectionBySlug(sectionSlug)
  if (!section) notFound()

  const paintings = await getPaintingsBySection(section.id)

  return (
    <div className="max-w-7xl mx-auto px-6 md:px-10 py-10 md:py-16">
      {/* Breadcrumb */}
      <Link
        href="/portfolio"
        className="text-xs uppercase tracking-[0.2em] font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        ← Portfolio
      </Link>

      <div className="mt-6 mb-10 md:mb-12">
        <h1 className="text-3xl md:text-5xl tracking-tight font-light font-serif mb-2">
          {section.title}
        </h1>
        {section.description && (
          <p className="text-base text-muted-foreground max-w-xl">
            {section.description}
          </p>
        )}
      </div>

      <SectionGallery paintings={paintings} sectionSlug={sectionSlug} />
    </div>
  )
}
