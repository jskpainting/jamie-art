"use client"

import Image from "next/image"
import type { SampleImage } from "@/lib/layout-samples"

interface AspectGridProps {
  images: SampleImage[]
  onImageClick: (index: number) => void
}

/**
 * Structured grid: fixed column count per breakpoint, each cell sized to its
 * image's intrinsic aspect ratio — images are never cropped and rows align to
 * the tallest cell. Each image controls its own height via w-full h-auto so
 * Next.js Image's height:auto inline style works with us, not against us.
 */
export function AspectGrid({ images, onImageClick }: AspectGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 items-start">
      {images.map((image, index) => (
        <button
          key={image.src}
          type="button"
          onClick={() => onImageClick(index)}
          className="group block w-full cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label={`View ${image.alt}`}
        >
          <span className="block shadow-sm transition-[transform,box-shadow] duration-200 motion-safe:group-hover:scale-[1.02] group-hover:shadow-lg">
            <Image
              src={image.src}
              alt={image.alt}
              width={image.width}
              height={image.height}
              sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
              loading="eager"
              className="w-full h-auto"
            />
          </span>
        </button>
      ))}
    </div>
  )
}
