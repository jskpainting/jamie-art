"use client"

import Image from "next/image"
import type { SampleImage } from "@/lib/layout-samples"

interface AspectGridProps {
  images: SampleImage[]
  onImageClick: (index: number) => void
}

/**
 * Structured grid: fixed column count per breakpoint, each cell sized to its
 * image's intrinsic aspect ratio via the CSS aspect-ratio property — images
 * are never cropped and rows align to the tallest cell.
 */
export function AspectGrid({ images, onImageClick }: AspectGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 items-start">
      {images.map((image, index) => (
        <button
          key={image.src}
          type="button"
          onClick={() => onImageClick(index)}
          className="group block w-full cursor-zoom-in rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          style={{ aspectRatio: `${image.width} / ${image.height}` }}
          aria-label={`View ${image.alt}`}
        >
          <span className="block h-full w-full overflow-hidden rounded-2xl shadow-sm transition-[transform,box-shadow] duration-200 motion-safe:group-hover:scale-[1.02] group-hover:shadow-lg">
            <Image
              src={image.src}
              alt={image.alt}
              width={image.width}
              height={image.height}
              sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
              className="h-full w-full object-contain"
            />
          </span>
        </button>
      ))}
    </div>
  )
}
