"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import type { SampleImage } from "@/lib/layout-samples"

interface JustifiedRowsProps {
  images: SampleImage[]
  onImageClick: (index: number) => void
}

interface PlacedImage {
  image: SampleImage
  index: number
  width: number
  height: number
}

const GAP = 12

function targetRowHeight(containerWidth: number): number {
  if (containerWidth >= 1024) return 280
  if (containerWidth >= 768) return 200
  return 160
}

/**
 * Flickr-style greedy row packing: accumulate images at the target row height
 * until they overflow the container, then scale that row's height down so the
 * widths fill the container exactly. The final row keeps the target height and
 * stays left-aligned rather than being stretched.
 */
function packRows(
  images: SampleImage[],
  containerWidth: number
): PlacedImage[][] {
  const rowHeight = targetRowHeight(containerWidth)
  const rows: PlacedImage[][] = []
  let current: { image: SampleImage; index: number; aspect: number }[] = []
  let currentAspectSum = 0

  const flush = (justify: boolean) => {
    if (current.length === 0) return
    const gaps = GAP * (current.length - 1)
    const height = justify
      ? (containerWidth - gaps) / currentAspectSum
      : Math.min(rowHeight, (containerWidth - gaps) / currentAspectSum)
    rows.push(
      current.map(({ image, index, aspect }) => ({
        image,
        index,
        width: aspect * height,
        height,
      }))
    )
    current = []
    currentAspectSum = 0
  }

  for (const [index, image] of images.entries()) {
    const aspect = image.width / image.height
    current.push({ image, index, aspect })
    currentAspectSum += aspect
    const gaps = GAP * (current.length - 1)
    if (currentAspectSum * rowHeight + gaps >= containerWidth) {
      flush(true)
    }
  }
  flush(false) // last partial row: target height, left-aligned

  return rows
}

export function JustifiedRows({ images, onImageClick }: JustifiedRowsProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState<number | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const rows =
    containerWidth !== null && containerWidth > 0
      ? packRows(images, containerWidth)
      : []

  return (
    <div ref={containerRef} className="w-full">
      {rows.map((row, rowIndex) => (
        <div
          key={rowIndex}
          className="flex"
          style={{ gap: GAP, marginBottom: GAP }}
        >
          {row.map(({ image, index, width, height }) => (
            <button
              key={image.src}
              type="button"
              onClick={() => onImageClick(index)}
              className="group block shrink-0 cursor-zoom-in rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              style={{ width, height }}
              aria-label={`View ${image.alt}`}
            >
              <span className="block h-full w-full overflow-hidden rounded-2xl shadow-sm transition-[transform,box-shadow] duration-200 motion-safe:group-hover:scale-[1.02] group-hover:shadow-lg">
                <Image
                  src={image.src}
                  alt={image.alt}
                  width={image.width}
                  height={image.height}
                  sizes="(min-width: 1024px) 33vw, 50vw"
                  className="h-full w-full object-cover"
                />
              </span>
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}
