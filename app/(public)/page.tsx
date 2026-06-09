import { HeroSection } from "@/components/hero-section"
import { SectionCard } from "@/components/section-card"
import { getSections } from "@/lib/db/queries"

export default async function HomePage() {
  const sections = await getSections()

  return (
    <>
      <HeroSection />

      {sections.length > 0 && (
        <section className="max-w-7xl mx-auto px-6 md:px-10 pb-20 md:pb-32">
          <p className="text-xs uppercase tracking-[0.2em] font-medium text-muted-foreground mb-8">
            Collections
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-10">
            {sections.map((section) => (
              <SectionCard key={section.id} section={section} />
            ))}
          </div>
        </section>
      )}
    </>
  )
}
