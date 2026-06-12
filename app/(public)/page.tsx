import { HeroSection } from "@/components/hero-section"
import { HomeEvents } from "@/components/home-events"
import {
  getAllEvents,
  getFeaturedPainting,
  getPaintingById,
  getBio,
  getSettings,
} from "@/lib/db/queries"

export default async function HomePage() {
  const [events, bio, settings] = await Promise.all([
    getAllEvents(),
    getBio(),
    getSettings(),
  ])

  // Three-way fallback for hero painting:
  // 1. settings.home_hero_image_url wins (handled in HeroSection)
  // 2. settings.featured_painting_id → specific catalog painting
  // 3. Latest available abstract (existing default)
  let featuredPainting = null
  if (settings?.featured_painting_id) {
    featuredPainting = await getPaintingById(settings.featured_painting_id)
  }
  if (!featuredPainting) {
    featuredPainting = await getFeaturedPainting()
  }

  return (
    <>
      <HeroSection
        painting={featuredPainting}
        bioTeaser={bio?.short_statement ?? null}
        heroImageUrl={settings?.home_hero_image_url ?? null}
      />
      <HomeEvents events={events} />
    </>
  )
}
