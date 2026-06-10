"use client"

import Image from "next/image"
import type { SampleImage } from "@/lib/layout-samples"

interface MasonryGridProps {
  images: SampleImage[]
  onImageClick: (index: number) => void
}

/**
 * Pinterest-style masonry via pure CSS columns — zero JS layout.
 * Items flow down each column at natural height, never cropped.
 */
export function MasonryGrid({ images, onImageClick }: MasonryGridProps) {
  return (
    <div className="columns-2 md:columns-3 lg:columns-4 gap-4 md:gap-5">
      {images.map((image, index) => (
        <button
          key={image.src}
          type="button"
          onClick={() => onImageClick(index)}
          className="group block w-full mb-4 md:mb-5 break-inside-avoid cursor-zoom-in rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label={`View ${image.alt}`}
        >
          <span className="block overflow-hidden rounded-2xl shadow-sm transition-[transform,box-shadow] duration-200 motion-safe:group-hover:scale-[1.02] group-hover:shadow-lg">
            <Image
              src={image.src}
              alt={image.alt}
              width={image.width}
              height={image.height}
              sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
              className="w-full h-auto"
            />
          </span>
        </button>
      ))}
    </div>
  )
}
