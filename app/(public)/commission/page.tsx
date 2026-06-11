import type { Metadata } from "next"
import { CommissionFormLoader } from "@/components/commission-form-loader"

export const metadata: Metadata = {
  title: "Commissions",
  description: "Commission an original painting by Jamie Kendrioski.",
}

type Props = {
  searchParams: Promise<{ painting?: string; painting_id?: string }>
}

export default async function CommissionPage({ searchParams }: Props) {
  const { painting, painting_id } = await searchParams

  return (
    <div className="max-w-7xl mx-auto px-6 md:px-10 py-10 md:py-16">
      {/* Hero image — TODO: replace placeholder with a real hero image */}
      <div className="w-full h-[240px] md:h-[320px] bg-muted mb-12" />

      <div className="max-w-2xl">
        <p className="text-xs uppercase tracking-[0.2em] font-medium text-muted-foreground mb-4">
          Commissions
        </p>
        <h1 className="font-serif text-4xl md:text-5xl font-light tracking-tight mb-6">
          Commissions
        </h1>
        {/* TODO: Basu — refine this intro copy */}
        <p className="text-base md:text-lg leading-relaxed text-muted-foreground mb-12">
          Jamie takes a limited number of commissions each year. Tell her what
          you have in mind — size, subject, palette, where it&rsquo;ll live —
          and she&rsquo;ll be in touch.
        </p>

        <CommissionFormLoader
          initialPainting={painting}
          initialPaintingId={painting_id}
        />
      </div>
    </div>
  )
}
