import type { MetadataRoute } from "next"
import { SITE_URL } from "@/lib/site"
import { getPublicSections, getPaintingsForSitemap } from "@/lib/db/queries"

export const dynamic = "force-dynamic"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [sections, paintings] = await Promise.all([
    getPublicSections(),
    getPaintingsForSitemap(),
  ])

  const now = new Date()

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/portfolio`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/events`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${SITE_URL}/commission`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
  ]

  const sectionRoutes: MetadataRoute.Sitemap = sections.map((s) => ({
    url: `${SITE_URL}/portfolio/${s.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.8,
  }))

  const paintingRoutes: MetadataRoute.Sitemap = paintings.map((p) => ({
    url: `${SITE_URL}/portfolio/${p.section_slug}/${p.slug}`,
    lastModified: p.updated_at ? new Date(p.updated_at) : now,
    changeFrequency: "monthly",
    priority: 0.7,
  }))

  return [...staticRoutes, ...sectionRoutes, ...paintingRoutes]
}
