"use client"

import { type ReactNode, useEffect, useRef, useState } from "react"

const DEFAULT_GAP = 12
const DEFAULT_ROW_HEIGHTS = { desktop: 280, tablet: 200, mobile: 160 }

function targetRowHeight(
  containerWidth: number,
  heights: { desktop: number; tablet: number; mobile: number }
): number {
  if (containerWidth >= 1024) return heights.desktop
  if (containerWidth >= 768) return heights.tablet
  return heights.mobile
}

interface PlacedItem<T> {
  item: T
  index: number
  width: number
  height: number
}

/**
 * Flickr-style greedy row packing: accumulate items at target row height
 * until they overflow the container, then scale that row down so widths fill
 * exactly. The final partial row keeps the target height and stays left-aligned.
 */
function packRows<T>(
  items: T[],
  getAspect: (item: T) => number,
  containerWidth: number,
  heights: { desktop: number; tablet: number; mobile: number },
  gap: number
): PlacedItem<T>[][] {
  const rowHeight = targetRowHeight(containerWidth, heights)
  const rows: PlacedItem<T>[][] = []
  let current: { item: T; index: number; aspect: number }[] = []
  let currentAspectSum = 0

  const flush = (justify: boolean) => {
    if (current.length === 0) return
    const gaps = gap * (current.length - 1)
    const height = justify
      ? (containerWidth - gaps) / currentAspectSum
      : Math.min(rowHeight, (containerWidth - gaps) / currentAspectSum)
    rows.push(
      current.map(({ item, index, aspect }) => ({
        item,
        index,
        width: aspect * height,
        height,
      }))
    )
    current = []
    currentAspectSum = 0
  }

  for (const [index, item] of items.entries()) {
    const aspect = getAspect(item)
    current.push({ item, index, aspect })
    currentAspectSum += aspect
    const gaps = gap * (current.length - 1)
    if (currentAspectSum * rowHeight + gaps >= containerWidth) {
      flush(true)
    }
  }
  flush(false) // last partial row: left-aligned at target height

  return rows
}

interface JustifiedRowsProps<T> {
  items: T[]
  /** Returns the intrinsic aspect ratio (width/height) for an item. */
  getAspect: (item: T) => number
  /** Stable key for each item. */
  getKey: (item: T) => string
  /** Renders the tile content inside its sized container. */
  renderItem: (
    item: T,
    index: number,
    width: number,
    height: number
  ) => ReactNode
  rowHeights?: { desktop: number; tablet: number; mobile: number }
  gap?: number
}

export function JustifiedRows<T>({
  items,
  getAspect,
  getKey,
  renderItem,
  rowHeights = DEFAULT_ROW_HEIGHTS,
  gap = DEFAULT_GAP,
}: JustifiedRowsProps<T>) {
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
      ? packRows(items, getAspect, containerWidth, rowHeights, gap)
      : []

  return (
    <div ref={containerRef} className="w-full">
      {rows.map((row, rowIndex) => (
        <div
          key={rowIndex}
          className="flex"
          style={{ gap, marginBottom: gap }}
        >
          {row.map(({ item, index, width, height }) => (
            <div key={getKey(item)} className="shrink-0" style={{ width, height }}>
              {renderItem(item, index, width, height)}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
