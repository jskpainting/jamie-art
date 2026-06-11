import { HeroSection } from "@/components/hero-section"
import { HomeEvents } from "@/components/home-events"
import { getAllEvents, getFeaturedPainting, getBio } from "@/lib/db/queries"

export default async function HomePage() {
  const [events, featuredPainting, bio] = await Promise.all([
    getAllEvents(),
    getFeaturedPainting(),
    getBio(),
  ])
  return (
    <>
      <HeroSection painting={featuredPainting} bioTeaser={bio?.short_statement ?? null} />
      <HomeEvents events={events} />
    </>
  )
}
