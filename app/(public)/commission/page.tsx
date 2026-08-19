import type { Metadata } from "next"
import Image from "next/image"
import { CommissionFormLoader } from "@/components/commission-form-loader"
import { getSettings } from "@/lib/db/queries"
import { SITE_COPY_DEFAULTS } from "@/lib/site-copy"
import { focalObjectPosition } from "@/lib/focal"

export const metadata: Metadata = {
  title: "Commissions — Custom Paintings",
  description:
    "Commission an original oil or acrylic painting by Boston artist Jamie Kendrioski. Share your size, subject, and palette to begin a custom piece.",
  alternates: { canonical: "/commission" },
  openGraph: {
    title: "Commission a Painting — Jamie Kendrioski",
    description:
      "Commission a custom original painting by Boston artist Jamie Kendrioski.",
    url: "/commission",
  },
}

type Props = {
  searchParams: Promise<{ painting?: string; painting_id?: string }>
}

export default async function CommissionPage({ searchParams }: Props) {
  const [{ painting, painting_id }, settings] = await Promise.all([
    searchParams,
    getSettings(),
  ])

  return (
    <div className="max-w-7xl mx-auto px-6 md:px-10 py-10 md:py-16">
      {/* Commission hero image */}
      {settings?.commission_image_url ? (
        <div className="relative w-full aspect-video overflow-hidden mb-12">
          <Image
            src={settings.commission_image_url}
            alt="Commission"
            fill
            className="object-cover"
            style={focalObjectPosition(settings?.commission_focal_x, settings?.commission_focal_y)}
            priority
            sizes="100vw"
            quality={90}
          />
        </div>
      ) : (
        /* TODO: replace placeholder with a real hero image via /admin/settings */
        <div className="w-full h-[240px] md:h-[320px] bg-muted mb-12" />
      )}

      <div className="max-w-2xl">
        <p className="text-xs uppercase tracking-[0.2em] font-medium text-muted-foreground mb-4">
          {settings?.commission_eyebrow?.trim() || SITE_COPY_DEFAULTS.commission_eyebrow}
        </p>
        <h1 className="font-serif text-4xl md:text-5xl font-light tracking-tight mb-6">
          {settings?.commission_heading?.trim() || SITE_COPY_DEFAULTS.commission_heading}
        </h1>
        <p className="text-base md:text-lg leading-relaxed text-muted-foreground mb-12 whitespace-pre-line">
          {settings?.commission_intro?.trim() || SITE_COPY_DEFAULTS.commission_intro}
        </p>

        <CommissionFormLoader
          initialPainting={painting}
          initialPaintingId={painting_id}
        />
      </div>
    </div>
  )
}
