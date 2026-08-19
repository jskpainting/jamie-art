import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { PaintingDetailView } from "@/components/painting-detail-view"
import { JsonLd } from "@/components/json-ld"
import { getPaintingBySlug, getSectionBySlug, getRelatedPaintings, getSettings, getArModelUrl } from "@/lib/db/queries"
import { SITE_URL, ARTIST_NAME, paintingAlt } from "@/lib/site"
import { parsePhysical } from "@/lib/mosaic-layout"
import type { PaintingWithImages } from "@/lib/types"

type Props = {
  params: Promise<{ section: string; slug: string }>
}

/** Build a concise, keyword-aware meta description for a painting. */
function paintingDescription(painting: PaintingWithImages): string {
  // A private story must never leak into meta description or JSON-LD.
  if (painting.story && painting.story.trim() && painting.story_public !== false) {
    const clean = painting.story.replace(/\s+/g, " ").trim()
    return clean.length > 160 ? `${clean.slice(0, 157)}…` : clean
  }
  const bits = [painting.medium, painting.dimensions].filter(Boolean).join(", ")
  return `${painting.title} — original ${bits ? `${bits} ` : ""}painting by ${ARTIST_NAME}, Boston.`
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { section, slug } = await params
  const painting = await getPaintingBySlug(section, slug)
  // notFound() in metadata → real 404 status (avoids a soft-404: 200 + 404 body).
  if (!painting) notFound()

  const title = `${painting.title} by ${ARTIST_NAME}`
  const description = paintingDescription(painting)
  const canonical = `/portfolio/${section}/${slug}`
  const image = painting.primary_image_url

  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    openGraph: {
      type: "article",
      title,
      description,
      url: canonical,
      images: image
        ? [{ url: image, alt: paintingAlt(painting.title) }]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: image ? [image] : undefined,
    },
  }
}

export default async function PaintingPage({ params }: Props) {
  const { section: sectionSlug, slug } = await params

  const [painting, section, settings] = await Promise.all([
    getPaintingBySlug(sectionSlug, slug),
    getSectionBySlug(sectionSlug),
    getSettings(),
  ])

  if (!painting || !section) notFound()

  const arModelUrl = await getArModelUrl(painting.id)

  const siteUrl = SITE_URL
  const paintingUrl = `${siteUrl}/portfolio/${sectionSlug}/${slug}`

  const { paintings: related, source: relatedSource } = await getRelatedPaintings(
    painting.id,
    painting.section_id,
    4
  )

  const relatedHeading =
    relatedSource === "tags" ? "Related work" : `More from ${section.title}`

  const dims = parsePhysical(painting.dimensions)
  const availabilityMap: Record<string, string | undefined> = {
    available: "https://schema.org/InStock",
    sold: "https://schema.org/SoldOut",
    reserved: "https://schema.org/LimitedAvailability",
    nfs: undefined,
  }

  const artworkLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "VisualArtwork",
    name: painting.title,
    url: paintingUrl,
    creator: { "@type": "Person", name: ARTIST_NAME, url: SITE_URL },
    artform: "Painting",
    description: paintingDescription(painting),
    ...(painting.primary_image_url ? { image: painting.primary_image_url } : {}),
    ...(painting.medium ? { artMedium: painting.medium } : {}),
    ...(painting.year ? { dateCreated: String(painting.year) } : {}),
    ...(dims
      ? {
          width: { "@type": "QuantitativeValue", value: dims[0], unitCode: "INH" },
          height: { "@type": "QuantitativeValue", value: dims[1], unitCode: "INH" },
        }
      : {}),
  }

  // Add a purchasable Offer when a price and a sellable status are known.
  if (painting.price_cents != null && availabilityMap[painting.status]) {
    artworkLd.offers = {
      "@type": "Offer",
      price: (painting.price_cents / 100).toFixed(2),
      priceCurrency: "USD",
      availability: availabilityMap[painting.status],
      url: paintingUrl,
      seller: { "@type": "Person", name: ARTIST_NAME },
    }
  }

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Portfolio", item: `${SITE_URL}/portfolio` },
      {
        "@type": "ListItem",
        position: 3,
        name: section.title,
        item: `${SITE_URL}/portfolio/${sectionSlug}`,
      },
      { "@type": "ListItem", position: 4, name: painting.title, item: paintingUrl },
    ],
  }

  return (
    <>
      <JsonLd data={[artworkLd, breadcrumbLd]} />
      <PaintingDetailView
        painting={painting}
        sectionSlug={sectionSlug}
        sectionTitle={section.title}
        settings={settings}
        paintingUrl={paintingUrl}
        arModelUrl={arModelUrl}
      />

      {related.length > 0 && (
        <section className="max-w-7xl mx-auto px-6 md:px-10 pb-20 md:pb-32">
          <div className="flex items-baseline justify-between gap-4 border-t border-border pt-10 mb-6">
            <p className="text-xs uppercase tracking-[0.2em] font-medium text-muted-foreground">
              {relatedHeading}
            </p>
            <Link
              href={`/portfolio/${sectionSlug}`}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 md:gap-6">
            {related.map((p) => (
              <Link
                key={p.id}
                href={`/portfolio/${p.home_section_slug || sectionSlug}/${p.slug}`}
                className="group block"
                aria-label={p.title}
              >
                <div className="relative aspect-square overflow-hidden bg-muted">
                  {p.primary_image_url && (
                    <Image
                      src={p.primary_image_url}
                      alt={paintingAlt(p.title)}
                      fill
                      sizes="(max-width: 640px) 50vw, 25vw"
                      quality={85}
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                  )}
                </div>
                <p className="mt-2.5 text-sm font-medium leading-tight truncate">
                  {p.title}
                </p>
                {p.year && (
                  <p className="text-xs text-muted-foreground">{p.year}</p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  )
}
