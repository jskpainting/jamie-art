"use client"

import { useEffect } from "react"
import Image from "next/image"
import { X } from "lucide-react"

interface ZoomOverlayProps {
  src: string
  alt: string
  open: boolean
  onClose: () => void
}

export function ZoomOverlay({ src, alt, open, onClose }: ZoomOverlayProps) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener("keydown", onKey)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/[0.95]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Zoom view"
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center text-white/80 hover:text-white transition-colors z-10"
        aria-label="Close zoom"
      >
        <X className="h-6 w-6" />
      </button>

      <div
        className="relative w-[95vw] h-[95vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <Image
          src={src}
          alt={alt}
          fill
          className="object-contain"
          sizes="95vw"
        />
      </div>
    </div>
  )
}
