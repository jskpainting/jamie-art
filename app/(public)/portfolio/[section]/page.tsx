import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { PairsGallery } from "@/components/pairs-gallery"
import { JsonLd } from "@/components/json-ld"
import { getSectionBySlug, getPaintingsBySection } from "@/lib/db/queries"
import { SITE_URL, ARTIST_NAME } from "@/lib/site"

type Props = {
  params: Promise<{ section: string }>
}

function sectionDescription(title: string, custom: string | null): string {
  if (custom && custom.trim()) return custom.trim()
  return `Original ${title} paintings by Boston artist ${ARTIST_NAME}, in oils and acrylics. Browse available works and enquire about pieces or commissions.`
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { section } = await params
  if (section === "uncategorized") return { title: "Not Found" }
  const data = await getSectionBySlug(section)
  if (!data) return { title: "Not Found" }
  const description = sectionDescription(data.title, data.description)
  return {
    title: `${data.title} — Paintings`,
    description,
    alternates: { canonical: `/portfolio/${section}` },
    openGraph: {
      title: `${data.title} — Jamie Kendrioski`,
      description,
      url: `/portfolio/${section}`,
      images: data.cover_image_url ? [{ url: data.cover_image_url }] : undefined,
    },
  }
}

export default async function SectionPage({ params }: Props) {
  const { section: sectionSlug } = await params
  if (sectionSlug === "uncategorized") notFound()
  const section = await getSectionBySlug(sectionSlug)
  if (!section) notFound()

  const paintings = await getPaintingsBySection(section.id)

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
      {
        "@type": "ListItem",
        position: 2,
        name: "Portfolio",
        item: `${SITE_URL}/portfolio`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: section.title,
        item: `${SITE_URL}/portfolio/${sectionSlug}`,
      },
    ],
  }

  return (
    <div className="max-w-7xl mx-auto px-6 md:px-10 py-10 md:py-16">
      <JsonLd data={breadcrumbLd} />
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

      <PairsGallery paintings={paintings} sectionSlug={sectionSlug} />
    </div>
  )
}
