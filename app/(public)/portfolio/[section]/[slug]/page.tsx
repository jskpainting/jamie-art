import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { PaintingDetailView } from "@/components/painting-detail-view"
import { getPaintingBySlug, getSectionBySlug, getRelatedPaintings } from "@/lib/db/queries"

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

  const [painting, section] = await Promise.all([
    getPaintingBySlug(sectionSlug, slug),
    getSectionBySlug(sectionSlug),
  ])

  if (!painting || !section) notFound()

  const related = await getRelatedPaintings(painting.id, painting.section_id, 4)

  return (
    <>
      <PaintingDetailView
        painting={painting}
        sectionSlug={sectionSlug}
        sectionTitle={section.title}
      />

      {related.length > 0 && (
        <section className="max-w-7xl mx-auto px-6 md:px-10 pb-20 md:pb-32">
          <p className="text-xs uppercase tracking-[0.2em] font-medium text-muted-foreground mb-6">
            More from {section.title}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {related.map((p) => (
              <a
                key={p.id}
                href={`/portfolio/${sectionSlug}/${p.slug}`}
                className="group block overflow-hidden bg-muted aspect-square relative"
                aria-label={p.title}
              >
                {p.primary_image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.primary_image_url}
                    alt={p.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                  />
                )}
              </a>
            ))}
          </div>
        </section>
      )}
    </>
  )
}
