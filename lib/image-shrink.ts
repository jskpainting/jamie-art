"use client"

// Client-side shrink + compress for photos headed to Supabase Storage via a
// signed URL. Decodes with EXIF orientation applied, downsizes to `maxPx` on
// the long edge, and exports a JPEG. Used by `lib/storage/upload.ts` so a
// phone photo never has to cross Vercel's 4.5 MB function body limit.

export interface ShrinkResult {
  blob: Blob
  width: number
  height: number
}

const JPEG_QUALITY = 0.9
// Skip re-encoding when the file is already a small JPEG — no point paying
// the canvas round-trip for a photo that's already well under the ceiling.
const SKIP_REENCODE_MAX_BYTES = 3 * 1024 * 1024 // 3 MB

interface Decoded {
  source: CanvasImageSource
  width: number
  height: number
  close?: () => void
}

async function decode(file: Blob): Promise<Decoded> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() }
    } catch {
      // Some browsers can't decode this particular file via createImageBitmap
      // (older Safari, some HEIC edge cases) — fall back to <img>.
    }
  }

  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new window.Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error("Couldn't read this photo — try another"))
      el.src = url
    })
    return { source: img, width: img.naturalWidth, height: img.naturalHeight }
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function probeDimensions(file: Blob): Promise<{ width: number; height: number } | null> {
  const url = URL.createObjectURL(file)
  try {
    return await new Promise((resolve) => {
      const img = new window.Image()
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
      img.onerror = () => resolve(null)
      img.src = url
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * Shrink + compress a photo for upload. Returns a JPEG blob at or under
 * `maxPx` on the long edge, plus its rendered pixel dimensions.
 */
export async function shrinkImage(file: Blob, maxPx = 4000): Promise<ShrinkResult> {
  const isSmallJpeg =
    (file.type === "image/jpeg" || file.type === "image/jpg") && file.size <= SKIP_REENCODE_MAX_BYTES

  if (isSmallJpeg) {
    const dims = await probeDimensions(file)
    if (dims && Math.max(dims.width, dims.height) <= maxPx) {
      return { blob: file, width: dims.width, height: dims.height }
    }
  }

  const decoded = await decode(file)
  const scale = Math.min(1, maxPx / Math.max(decoded.width, decoded.height))
  const outW = Math.max(1, Math.round(decoded.width * scale))
  const outH = Math.max(1, Math.round(decoded.height * scale))

  const canvas = document.createElement("canvas")
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Couldn't process this photo — try another")
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(decoded.source, 0, 0, outW, outH)
  decoded.close?.()

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Couldn't process this photo — try another"))),
      "image/jpeg",
      JPEG_QUALITY
    )
  )

  return { blob, width: outW, height: outH }
}
