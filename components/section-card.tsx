import Link from "next/link"
import { ImageWithSkeleton } from "@/components/image-with-skeleton"
import { focalObjectPosition } from "@/lib/focal"
import type { Section } from "@/lib/types"

const sectionColors: Record<string, string> = {
  abstracts: "hsl(16 60% 72%)",
  "cityscapes-seascapes": "hsl(210 30% 68%)",
  florals: "hsl(340 40% 75%)",
  "pixels-rainbows": "hsl(270 30% 72%)",
}

interface SectionCardProps {
  section: Section & { painting_count?: number }
}

export function SectionCard({ section }: SectionCardProps) {
  const fallbackColor = sectionColors[section.slug] ?? "hsl(0 0% 80%)"

  return (
    <Link
      href={`/portfolio/${section.slug}`}
      className="group block overflow-hidden border border-border hover:border-muted-foreground/30 transition-colors"
    >
      <div className="aspect-[4/3] relative overflow-hidden">
        {section.cover_image_url ? (
          <ImageWithSkeleton
            src={section.cover_image_url}
            alt={`${section.title} paintings by Jamie Kendrioski`}
            fill
            sizes="(min-width: 640px) 50vw, 100vw"
            className="object-cover transition-all duration-500 group-hover:scale-[1.03] group-hover:brightness-95"
            style={focalObjectPosition(section.cover_focal_x, section.cover_focal_y)}
          />
        ) : (
          <div
            className="w-full h-full transition-transform duration-500 group-hover:scale-[1.02]"
            style={{ backgroundColor: fallbackColor }}
            aria-hidden="true"
          />
        )}
      </div>
      <div className="p-5 md:p-6">
        <h2 className="text-xl md:text-2xl font-medium font-serif mb-1">
          {section.title}
        </h2>
        {section.description && (
          <p className="text-sm text-muted-foreground mb-3">
            {section.description}
          </p>
        )}
        <span className="text-sm font-medium text-foreground group-hover:underline underline-offset-4">
          Explore →
        </span>
      </div>
    </Link>
  )
}
