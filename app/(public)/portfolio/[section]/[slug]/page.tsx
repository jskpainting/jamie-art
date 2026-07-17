import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { PaintingDetailView } from "@/components/painting-detail-view"
import { getPaintingBySlug, getSectionBySlug, getRelatedPaintings, getSettings } from "@/lib/db/queries"

type Props = {
  params: Promise<{ section: string; slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { section, slug } = await params
  const painting = await getPaintingBySlug(section, slug)
  if (!painting) return { title: "Not Found" }
  return {
    title: painting.title,
    description: painting.story
      ? painting.story.slice(0, 160)
      : `${painting.title} — original painting by Jamie Kendrioski`,
    openGraph: painting.primary_image_url
      ? { images: [{ url: painting.primary_image_url }] }
      : undefined,
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

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://jamiekendrioski.com"
  const paintingUrl = `${siteUrl}/portfolio/${sectionSlug}/${slug}`

  const { paintings: related, source: relatedSource } = await getRelatedPaintings(
    painting.id,
    painting.section_id,
    4
  )

  const relatedHeading =
    relatedSource === "tags" ? "Related work" : `More from ${section.title}`

  return (
    <>
      <PaintingDetailView
        painting={painting}
        sectionSlug={sectionSlug}
        sectionTitle={section.title}
        settings={settings}
        paintingUrl={paintingUrl}
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
                href={`/portfolio/${sectionSlug}/${p.slug}`}
                className="group block"
                aria-label={p.title}
              >
                <div className="relative aspect-square overflow-hidden bg-muted">
                  {p.primary_image_url && (
                    <Image
                      src={p.primary_image_url}
                      alt={p.title}
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
