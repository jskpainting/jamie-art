"use client"

import Image from "next/image"
import type { Painting } from "@/lib/types"

interface PaintingCardProps {
  painting: Painting
  onClick: () => void
}

export function PaintingCard({ painting, onClick }: PaintingCardProps) {
  return (
    <button
      onClick={onClick}
      className="group relative block aspect-square w-full overflow-hidden bg-muted cursor-zoom-in"
      aria-label={`View ${painting.title}`}
    >
      {painting.primary_image_url ? (
        <Image
          src={painting.primary_image_url}
          alt={painting.title}
          fill
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
      ) : (
        <div className="w-full h-full bg-muted" aria-hidden="true" />
      )}

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/40 transition-colors duration-300 flex items-end p-3 md:p-4">
        <div className="translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
          <p className="text-sm font-medium text-white leading-snug line-clamp-1">
            {painting.title}
          </p>
          {painting.medium && (
            <p className="text-xs text-white/80 mt-0.5">{painting.medium}</p>
          )}
        </div>
      </div>
    </button>
  )
}
