import type { Metadata } from "next"
import { SectionCard } from "@/components/section-card"
import { EmptyState } from "@/components/empty-state"
import { getPublicSections } from "@/lib/db/queries"

export const metadata: Metadata = {
  title: "Portfolio — Original Paintings",
  description:
    "Browse original oil and acrylic paintings by Boston artist Jamie Kendrioski — abstracts, cityscapes, seascapes, florals, and Pixels & Rainbows. Available works and commissions.",
  alternates: { canonical: "/portfolio" },
  openGraph: {
    title: "Portfolio — Jamie Kendrioski",
    description:
      "Original oil and acrylic paintings by Boston artist Jamie Kendrioski.",
    url: "/portfolio",
  },
}

export default async function PortfolioPage() {
  const sections = await getPublicSections()

  return (
    <div className="max-w-7xl mx-auto px-6 md:px-10 py-20 md:py-32">
      <div className="mb-12 md:mb-16">
        <p className="text-xs uppercase tracking-[0.2em] font-medium text-muted-foreground mb-3">
          Portfolio
        </p>
        <h1 className="text-3xl md:text-5xl tracking-tight font-light font-serif">
          The Work
        </h1>
      </div>

      {sections.length === 0 ? (
        <EmptyState
          title="Collections coming soon"
          description="New work is being added. Check back shortly."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-10">
          {sections.map((section) => (
            <SectionCard key={section.id} section={section} />
          ))}
        </div>
      )}
    </div>
  )
}
