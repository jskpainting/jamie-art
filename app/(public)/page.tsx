import { HeroSection } from "@/components/hero-section"
import { HomeEvents } from "@/components/home-events"
import { getAllEvents, getFeaturedPainting, getBio, getSettings } from "@/lib/db/queries"

export default async function HomePage() {
  const [events, featuredPainting, bio, settings] = await Promise.all([
    getAllEvents(),
    getFeaturedPainting(),
    getBio(),
    getSettings(),
  ])
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
