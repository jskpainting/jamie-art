"use client"

// Shared canvas pipeline for every admin image editor (fresh upload, library
// re-crop, and the post-save "Edit" affordance). Pure client-side util —
// never touches the network or the DB. `ImageUploadCropper` and
// `ImageEditorDialog` both call `renderEdit`, and `cover-image-picker.tsx`
// uses it in place of its own duplicated `compress()`.

import type { Area } from "react-easy-crop"

export interface EditRecipe {
  /** Natural-pixel crop rectangle from the source image, or null = full image. */
  crop: { x: number; y: number; width: number; height: number } | null
  /** 1.0 = no change. Owner range is 0.70–1.30. */
  brightness: number
  /** 1.0 = no change. Owner range is 0.85–1.15. */
  contrast: number
}

export const IDENTITY_RECIPE: EditRecipe = { crop: null, brightness: 1, contrast: 1 }

export function isIdentityRecipe(recipe: EditRecipe): boolean {
  return recipe.crop === null && recipe.brightness === 1 && recipe.contrast === 1
}

export function areaToRecipeCrop(area: Area): EditRecipe["crop"] {
  return { x: area.x, y: area.y, width: area.width, height: area.height }
}

/** Feature-detect canvas `filter` support once — no polyfill, no pixel loops. */
export function supportsCanvasFilter(): boolean {
  if (typeof document === "undefined") return false
  const ctx = document.createElement("canvas").getContext("2d")
  return !!ctx && "filter" in ctx
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("Failed to load image for processing"))
    img.src = src
  })
}

/** Natural pixel dimensions of an already-loadable image URL/data URL. */
export async function loadImageDims(
  src: string
): Promise<{ width: number; height: number }> {
  const img = await loadImage(src)
  return { width: img.naturalWidth, height: img.naturalHeight }
}

export function filterCss(recipe: EditRecipe): string {
  return `brightness(${recipe.brightness}) contrast(${recipe.contrast})`
}

/**
 * Render an EditRecipe (crop + brightness/contrast) onto a canvas and return
 * a compressed JPEG blob, mirroring the historical `compress()` behaviour:
 * scale down to `maxOutputPx` on the long edge, `imageSmoothingQuality: high`,
 * JPEG quality 0.95. Brightness/contrast are baked in via `ctx.filter`
 * immediately before `drawImage` — skipped entirely for an identity recipe,
 * and only if the browser supports canvas filters.
 */
export async function renderEdit(
  imageSrc: string,
  recipe: EditRecipe,
  maxOutputPx: number
): Promise<{ blob: Blob; width: number; height: number }> {
  const img = await loadImage(imageSrc)

  const srcX = recipe.crop?.x ?? 0
  const srcY = recipe.crop?.y ?? 0
  const srcW = recipe.crop?.width ?? img.naturalWidth
  const srcH = recipe.crop?.height ?? img.naturalHeight

  if (srcW < 1 || srcH < 1) {
    throw new Error("Crop area is too small — try zooming out")
  }

  const scale = Math.min(1, maxOutputPx / Math.max(srcW, srcH))
  const outW = Math.round(srcW * scale)
  const outH = Math.round(srcH * scale)

  const canvas = document.createElement("canvas")
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Could not get canvas context")

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"

  const hasAdjustments = recipe.brightness !== 1 || recipe.contrast !== 1
  if (hasAdjustments && "filter" in ctx) {
    ctx.filter = filterCss(recipe)
  }

  ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, outW, outH)

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) =>
        b
          ? resolve(b)
          : reject(new Error("Image conversion failed — try a different file")),
      "image/jpeg",
      0.95
    )
  )

  return { blob, width: outW, height: outH }
}

/** Parse a Supabase public storage URL into { bucket, path }, or null. */
export function parsePublicStorageUrl(
  url: string
): { bucket: string; path: string } | null {
  const marker = "/storage/v1/object/public/"
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  const rest = url.slice(idx + marker.length)
  const slash = rest.indexOf("/")
  if (slash === -1) return null
  return { bucket: rest.slice(0, slash), path: rest.slice(slash + 1) }
}
