"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import { focalObjectPosition } from "@/lib/focal"

interface FocalPointPickerProps {
  imageUrl: string
  focalX: number
  focalY: number
  onChange: (x: number, y: number) => void
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/**
 * Click/drag/keyboard picker for an image's focal point (0–100% x/y). Shows a
 * live crosshair on the source image plus a phone/tablet/desktop crop preview
 * strip so the owner can see exactly what stays visible at each aspect ratio.
 */
export function FocalPointPicker({ imageUrl, focalX, focalY, onChange }: FocalPointPickerProps) {
  const boxRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Local state drives the crosshair/preview instantly; onChange (the server
  // action) is debounced so dragging doesn't fire a save per pixel. Seeded
  // once from props — this component owns the point once mounted, same
  // pattern as the rest of the admin forms (e.g. BioForm's local state).
  const [pos, setPos] = useState({ x: focalX ?? 50, y: focalY ?? 50 })
  // Mirrors `pos` for use in event handlers / the unmount cleanup, where
  // reading the latest value without waiting on a render is required —
  // updated alongside every setPos call below, never during render.
  const posRef = useRef(pos)
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const commit = useCallback((x: number, y: number) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null
      onChangeRef.current(x, y)
    }, 400)
  }, [])

  useEffect(() => {
    return () => {
      // A pending debounce means the last drag/keypress hasn't been saved
      // yet — flush it now instead of silently discarding the edit.
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
        onChangeRef.current(posRef.current.x, posRef.current.y)
      }
    }
  }, [])

  const setFromClient = useCallback(
    (clientX: number, clientY: number) => {
      const el = boxRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const x = clamp(((clientX - rect.left) / rect.width) * 100, 0, 100)
      const y = clamp(((clientY - rect.top) / rect.height) * 100, 0, 100)
      posRef.current = { x, y }
      setPos({ x, y })
      commit(x, y)
    },
    [commit]
  )

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    draggingRef.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    setFromClient(e.clientX, e.clientY)
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return
    setFromClient(e.clientX, e.clientY)
  }

  function handlePointerUp() {
    draggingRef.current = false
    // Flush immediately on release rather than waiting out the drag debounce.
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
      onChangeRef.current(posRef.current.x, posRef.current.y)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const step = e.shiftKey ? 10 : 2
    let { x, y } = pos
    if (e.key === "ArrowLeft") x = clamp(x - step, 0, 100)
    else if (e.key === "ArrowRight") x = clamp(x + step, 0, 100)
    else if (e.key === "ArrowUp") y = clamp(y - step, 0, 100)
    else if (e.key === "ArrowDown") y = clamp(y + step, 0, 100)
    else return
    e.preventDefault()
    posRef.current = { x, y }
    setPos({ x, y })
    commit(x, y)
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground leading-relaxed max-w-[360px]">
        Click the most important part of the image — usually a face. The site
        keeps this point visible however the image is cropped.
      </p>

      <div
        ref={boxRef}
        role="slider"
        tabIndex={0}
        aria-label="Image focal point"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pos.x)}
        aria-valuetext={`${Math.round(pos.x)}% across, ${Math.round(pos.y)}% down`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
        className="relative w-full max-w-[360px] bg-muted cursor-crosshair select-none outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Image
          src={imageUrl}
          alt="Click to set the focal point"
          width={720}
          height={720}
          className="w-full h-auto"
          sizes="360px"
          draggable={false}
        />
        <div
          className="absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md ring-1 ring-black/30 pointer-events-none"
          style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
        />
      </div>

      <div className="grid grid-cols-3 gap-3 max-w-[360px]">
        <div className="flex flex-col gap-1.5">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Phone</p>
          <div className="relative aspect-[3/4] overflow-hidden bg-muted">
            <Image
              src={imageUrl}
              alt=""
              fill
              className="object-cover"
              style={focalObjectPosition(pos.x, pos.y)}
              sizes="120px"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Tablet</p>
          <div className="relative aspect-square overflow-hidden bg-muted">
            <Image
              src={imageUrl}
              alt=""
              fill
              className="object-cover"
              style={focalObjectPosition(pos.x, pos.y)}
              sizes="120px"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Desktop</p>
          <div className="relative aspect-[16/10] overflow-hidden bg-muted">
            <Image
              src={imageUrl}
              alt=""
              fill
              className="object-cover"
              style={focalObjectPosition(pos.x, pos.y)}
              sizes="120px"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
