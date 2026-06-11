import { HeroSection } from "@/components/hero-section"
import { HomeEvents } from "@/components/home-events"
import { getAllEvents } from "@/lib/db/queries"

export default async function HomePage() {
  const events = await getAllEvents()
  return (
    <>
      <HeroSection />
      <HomeEvents events={events} />
    </>
  )
}
