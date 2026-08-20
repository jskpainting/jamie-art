"use client"

import { useEffect, useMemo, useState } from "react"
import Cropper from "react-easy-crop"
import type { Area } from "react-easy-crop"
import "react-easy-crop/react-easy-crop.css"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ImagePreset, Ratio } from "@/lib/image-presets"
import {
  areaToRecipeCrop,
  filterCss,
  loadImageDims,
  renderEdit,
  supportsCanvasFilter,
  type EditRecipe,
} from "@/lib/image-edit"

function ratioLabel(r: Ratio): string {
  if (r === "free") return "Free"
  if (r === 1) return "1:1"
  if (Math.abs(r - 4 / 5) < 0.001) return "4:5"
  if (Math.abs(r - 4 / 3) < 0.001) return "4:3"
  if (Math.abs(r - 3 / 4) < 0.001) return "3:4"
  if (Math.abs(r - 16 / 9) < 0.001) return "16:9"
  return r.toFixed(2)
}

function ratioKey(r: Ratio): string {
  return r === "free" ? "free" : r.toFixed(4)
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

/** Best small-integer approximation of a ratio, e.g. 0.667 -> "2:3". */
function approxRatioLabel(ratio: number): string {
  let bestN = 1
  let bestD = 1
  let bestErr = Infinity
  for (let d = 1; d <= 12; d++) {
    const n = Math.round(ratio * d)
    if (n < 1) continue
    const err = Math.abs(ratio - n / d)
    if (err < bestErr) {
      bestErr = err
      bestN = n
      bestD = d
    }
  }
  const g = gcd(bestN, bestD) || 1
  return `${bestN / g}:${bestD / g}`
}

export interface ImageEditorSaveResult {
  blob: Blob
  recipe: EditRecipe
  width: number
  height: number
}

export interface ImageEditorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Data URL (or CORS-safe URL) of the full-resolution source image. */
  src: string | null
  preset: ImagePreset
  initialRecipe?: EditRecipe | null
  /** Physical width/height ratio (in / in) to nudge the crop toward, when known. */
  physicalRatio?: number | null
  /** Display label for the physical size, e.g. "24 × 36 in". */
  physicalDimsLabel?: string | null
  onSave: (result: ImageEditorSaveResult) => void | Promise<void>
  saving: boolean
  /** Shown as a quiet text button when re-editing an image that already has a recipe. */
  onRevert?: () => void
  title?: string
}

// Outer component owns only the Dialog shell. The body remounts fresh
// (via `key={src}`) every time a different image is opened, so all editor
// state initializes from props through plain `useState` initializers instead
// of a same-instance effect writing state on top of a previous image's edits.
export function ImageEditorDialog(props: ImageEditorDialogProps) {
  const { open, onOpenChange, src, saving } = props
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !saving) onOpenChange(false)
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="w-full max-w-[calc(100%-2rem)] sm:max-w-2xl p-0 gap-0 h-[100dvh] sm:h-auto flex flex-col overflow-hidden"
      >
        {src && <ImageEditorBody key={src} {...props} src={src} />}
      </DialogContent>
    </Dialog>
  )
}

function ImageEditorBody({
  src,
  preset,
  initialRecipe,
  physicalRatio,
  physicalDimsLabel,
  onSave,
  saving,
  onRevert,
  onOpenChange,
  title,
}: ImageEditorDialogProps & { src: string }) {
  const [naturalDims, setNaturalDims] = useState<{ width: number; height: number } | null>(null)
  const [selectedRatio, setSelectedRatio] = useState<Ratio>(preset.ratio)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [cropTouched, setCropTouched] = useState(false)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  // "Keep as is" on the physical-shape banner — hides the nudge for this open
  // without changing the crop. Resets whenever a different image is opened
  // (this whole component remounts via `key={src}`).
  const [shapeNudgeDismissed, setShapeNudgeDismissed] = useState(false)

  const [brightness, setBrightness] = useState(
    initialRecipe ? Math.round(initialRecipe.brightness * 100) : 100
  )
  const [contrast, setContrast] = useState(
    initialRecipe ? Math.round(initialRecipe.contrast * 100) : 100
  )
  const [comparing, setComparing] = useState(false)

  const filterSupported = useMemo(() => supportsCanvasFilter(), [])

  // Only reads the source image's own pixel size — an async lookup, not a
  // same-render setState-on-mount, so it's fine inside an effect.
  useEffect(() => {
    let cancelled = false
    loadImageDims(src).then(
      (dims) => !cancelled && setNaturalDims(dims),
      () => !cancelled && setNaturalDims(null)
    )
    return () => {
      cancelled = true
    }
  }, [src])

  const chips: Ratio[] = preset.paintingRules ? [] : [preset.ratio, ...preset.altRatios]

  // Physical-shape nudge (design plan IE-4 / A1) — paintings only, never
  // forced. `selectedRatio` becomes `physicalRatio` once the owner taps
  // "Match painting shape"; at that point the crop aspect and the physical
  // ratio are equal by construction, so the mismatch check naturally reads
  // as matched without extra state to keep in sync.
  const hasPhysicalRatio = preset.paintingRules && typeof physicalRatio === "number" && physicalRatio > 0
  const shapeMatched =
    hasPhysicalRatio && selectedRatio !== "free" && ratioKey(selectedRatio) === ratioKey(physicalRatio!)
  const photoAspect = naturalDims ? naturalDims.width / naturalDims.height : null
  const shapeDeviation =
    hasPhysicalRatio && photoAspect ? Math.abs(photoAspect / physicalRatio! - 1) : null

  function matchPaintingShape() {
    if (!hasPhysicalRatio) return
    setSelectedRatio(physicalRatio!)
    setCropTouched(true)
  }

  function unmatchPaintingShape() {
    setSelectedRatio("free")
    setCropTouched(true)
  }

  const aspectForCropper =
    selectedRatio === "free"
      ? naturalDims
        ? naturalDims.width / naturalDims.height
        : 1
      : selectedRatio

  // A fixed (non-"free") ratio always applies a meaningful crop, even if the
  // owner never touched the pan/zoom controls — the centered box IS the crop.
  // "Free" mode defaults to no trim at all until the owner actually drags/zooms,
  // which lets an untouched re-edit of a painting come back out as an identity
  // recipe (no new derivative gets rendered).
  const recipe: EditRecipe = {
    crop:
      selectedRatio === "free"
        ? cropTouched && croppedAreaPixels
          ? areaToRecipeCrop(croppedAreaPixels)
          : null
        : croppedAreaPixels
          ? areaToRecipeCrop(croppedAreaPixels)
          : null,
    brightness: brightness / 100,
    contrast: contrast / 100,
  }

  const showSmallWarning =
    !!preset.minPx &&
    !!naturalDims &&
    (naturalDims.width < preset.minPx.width || naturalDims.height < preset.minPx.height)

  const adjustmentsChanged = brightness !== 100 || contrast !== 100

  async function handleSave() {
    if (!src) return
    const rendered = await renderEdit(src, recipe, preset.maxOutputPx)
    await onSave({ blob: rendered.blob, recipe, width: rendered.width, height: rendered.height })
  }

  return (
    <>
      <DialogHeader className="px-4 pt-4 pb-3 shrink-0 border-b border-border">
        <DialogTitle>{title ?? `Edit ${preset.label}`}</DialogTitle>
      </DialogHeader>

      {chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-4 pt-3 shrink-0">
            {chips.map((r) => (
              <button
                key={ratioKey(r)}
                type="button"
                onClick={() => {
                  setSelectedRatio(r)
                  setCropTouched(true)
                }}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  ratioKey(r) === ratioKey(selectedRatio)
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:border-foreground/50"
                )}
              >
                {ratioLabel(r)}
              </button>
            ))}
          </div>
        )}

        {/* Physical-shape nudge — paintings only. Never forces a crop; the
            owner can always dismiss or return to a free trim. */}
        {preset.paintingRules && (
          <div className="px-4 pt-3 shrink-0">
            {shapeMatched ? (
              <button
                type="button"
                onClick={unmatchPaintingShape}
                className="inline-flex items-center gap-1.5 rounded-full border border-foreground bg-foreground px-3 py-1 text-xs text-background"
              >
                Painting shape · {approxRatioLabel(physicalRatio!)}
                <span aria-hidden>✕</span>
                <span className="sr-only">Return to free crop</span>
              </button>
            ) : !hasPhysicalRatio ? (
              <p className="text-xs text-muted-foreground">
                Add dimensions (like 24&quot; × 36&quot;) and I can check the
                photo matches the painting&rsquo;s shape.
              </p>
            ) : shapeDeviation != null && shapeDeviation <= 0.03 ? (
              <p className="text-xs text-muted-foreground">
                Matches the painting&rsquo;s {physicalDimsLabel ?? "shape"} shape ✓
              </p>
            ) : shapeDeviation != null && !shapeNudgeDismissed ? (
              <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-2">
                <p className="text-xs text-foreground leading-relaxed">
                  Your painting is {physicalDimsLabel ?? "a different shape"} — crop
                  the photo to that shape?
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={matchPaintingShape}
                    className="rounded-md bg-foreground px-2.5 py-1 text-xs text-background"
                  >
                    Match painting shape
                  </button>
                  <button
                    type="button"
                    onClick={() => setShapeNudgeDismissed(true)}
                    className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Keep as is
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/*
          Fixed explicit height — the root fix for the original null-toBlob bug.
          A `flex-1` height inside `sm:h-auto` collapses the canvas to 0px and
          produces a 0×0 canvas / null toBlob. Keep this explicit.
        */}
        <div className="relative w-full h-[60dvh] sm:h-[400px] bg-black overflow-hidden shrink-0 mt-3">
          {src && (
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              aspect={aspectForCropper}
              style={{ mediaStyle: { filter: comparing ? "none" : filterCss(recipe) } }}
              onCropChange={(c) => {
                setCrop(c)
                setCropTouched(true)
              }}
              onZoomChange={(z) => {
                setZoom(z)
                setCropTouched(true)
              }}
              onCropComplete={(_area, pixels) => setCroppedAreaPixels(pixels)}
            />
          )}
        </div>

        {showSmallWarning && (
          <p className="px-4 pt-2 text-xs text-amber-600 dark:text-amber-500 shrink-0">
            This photo is a bit small for this spot (best at {preset.minPx!.width} px wide or
            more) — it may look soft.
          </p>
        )}

        <div className="px-4 py-3 shrink-0 border-t border-border space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Zoom</label>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => {
                setZoom(Number(e.target.value))
                setCropTouched(true)
              }}
              className="w-full accent-foreground"
            />
          </div>

          {filterSupported && (
            <>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-muted-foreground">
                    Brightness — {brightness}%
                  </label>
                </div>
                <input
                  type="range"
                  min={70}
                  max={130}
                  step={1}
                  value={brightness}
                  onChange={(e) => setBrightness(Number(e.target.value))}
                  className="w-full accent-foreground"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-muted-foreground">
                    Contrast — {contrast}%
                  </label>
                </div>
                <input
                  type="range"
                  min={85}
                  max={115}
                  step={1}
                  value={contrast}
                  onChange={(e) => setContrast(Number(e.target.value))}
                  className="w-full accent-foreground"
                />
              </div>

              <div className="flex items-center gap-3">
                {adjustmentsChanged && (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
                    onClick={() => {
                      setBrightness(100)
                      setContrast(100)
                    }}
                  >
                    Reset
                  </button>
                )}
                <button
                  type="button"
                  className="select-none rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
                  onPointerDown={() => setComparing(true)}
                  onPointerUp={() => setComparing(false)}
                  onPointerLeave={() => setComparing(false)}
                >
                  {comparing ? "Original" : "Compare"}
                </button>
                {onRevert && (
                  <button
                    type="button"
                    className="ml-auto text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
                    onClick={onRevert}
                    disabled={saving}
                  >
                    Revert to original
                  </button>
                )}
              </div>

              {preset.paintingRules && (
                <p className="text-xs text-muted-foreground">
                  Small corrections for photos taken in dim light. Hold Compare to check against
                  the original — the painting&rsquo;s colours should still look true.
                </p>
              )}
            </>
          )}

          {!filterSupported && onRevert && (
            <button
              type="button"
              className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
              onClick={onRevert}
              disabled={saving}
            >
              Revert to original
            </button>
          )}
        </div>

        <DialogFooter className="shrink-0 rounded-none border-t px-4 py-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving || !src} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? "Saving…" : "Save"}
          </Button>
      </DialogFooter>
    </>
  )
}
