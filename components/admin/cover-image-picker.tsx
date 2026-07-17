"use client"

import { useState, useRef } from "react"
import Cropper from "react-easy-crop"
import type { Area } from "react-easy-crop"
import "react-easy-crop/react-easy-crop.css"
import Image from "next/image"
import { Loader2, Upload, ImageIcon, Images } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  listSectionPaintingImages,
  type SectionPaintingImage,
} from "@/lib/actions/covers"

const COVER_ASPECT = 4 / 3 // matches the public section card (aspect-[4/3])
const MAX_OUTPUT_PX = 4000
const BUCKET = "site-images"

// Crop + compress an image data-URL to a JPEG blob (mirrors ImageUploadCropper).
async function compress(imageSrc: string, cropPixels?: Area): Promise<Blob> {
  const img = new window.Image()
  img.src = imageSrc
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error("Failed to load image for processing"))
  })

  const srcX = cropPixels?.x ?? 0
  const srcY = cropPixels?.y ?? 0
  const srcW = cropPixels?.width ?? img.naturalWidth
  const srcH = cropPixels?.height ?? img.naturalHeight
  if (srcW < 1 || srcH < 1) throw new Error("Crop area is too small — try zooming out")

  const scale = Math.min(1, MAX_OUTPUT_PX / Math.max(srcW, srcH))
  const outW = Math.round(srcW * scale)
  const outH = Math.round(srcH * scale)

  const canvas = document.createElement("canvas")
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Could not get canvas context")
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, outW, outH)

  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Image conversion failed"))),
      "image/jpeg",
      0.95
    )
  )
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(new Error("Failed to read image"))
    r.readAsDataURL(blob)
  })
}

interface CoverImagePickerProps {
  /** Section id — enables "choose from paintings". Omit for a brand-new section. */
  sectionId?: string
  currentImageUrl: string | null
  onChange: (url: string | null) => void
}

export function CoverImagePicker({
  sectionId,
  currentImageUrl,
  onChange,
}: CoverImagePickerProps) {
  const [localUrl, setLocalUrl] = useState<string | null>(currentImageUrl)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Painting picker dialog
  const [pickerOpen, setPickerOpen] = useState(false)
  const [paintings, setPaintings] = useState<SectionPaintingImage[]>([])
  const [loadingPaintings, setLoadingPaintings] = useState(false)

  // Crop dialog
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function startCrop(dataUrl: string) {
    setImageSrc(dataUrl)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setCroppedAreaPixels(null)
    setError(null)
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    if (file.size > 20 * 1024 * 1024) {
      toast.error("File must be under 20 MB", { duration: 5000 })
      return
    }
    startCrop(await blobToDataUrl(file))
  }

  async function openPaintingPicker() {
    if (!sectionId) return
    setPickerOpen(true)
    setLoadingPaintings(true)
    const res = await listSectionPaintingImages(sectionId)
    setLoadingPaintings(false)
    if (!res.ok) {
      toast.error(res.error, { duration: 5000 })
      setPickerOpen(false)
      return
    }
    setPaintings(res.images)
  }

  async function choosePainting(p: SectionPaintingImage) {
    setPickerOpen(false)
    try {
      const resp = await fetch(p.primary_image_url)
      const blob = await resp.blob()
      startCrop(await blobToDataUrl(blob))
    } catch {
      toast.error("Couldn't load that image — try another", { duration: 5000 })
    }
  }

  async function saveCrop() {
    if (!imageSrc || !croppedAreaPixels) return
    setSaving(true)
    setError(null)
    try {
      const blob = await compress(imageSrc, croppedAreaPixels)
      const formData = new FormData()
      formData.append("file", blob, "cover.jpg")
      formData.append("bucket", BUCKET)
      const res = await fetch("/api/admin/upload", { method: "POST", body: formData })
      const json = (await res.json()) as { url?: string; error?: string }
      if (!res.ok || !json.url) throw new Error(json.error ?? "Upload failed")
      setLocalUrl(json.url)
      onChange(json.url)
      setImageSrc(null)
      toast.success("Cover updated", { duration: 5000 })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Current cover preview */}
      <div className="relative w-full max-w-[280px] aspect-[4/3] overflow-hidden rounded-lg border border-border bg-muted">
        {localUrl ? (
          <Image src={localUrl} alt="Cover" fill sizes="280px" className="object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {sectionId && (
          <Button type="button" variant="outline" size="sm" onClick={openPaintingPicker}>
            <Images className="h-3.5 w-3.5 mr-1" />
            Choose from paintings
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-3.5 w-3.5 mr-1" />
          Upload
        </Button>
        {localUrl && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setLocalUrl(null)
              onChange(null)
            }}
          >
            Remove
          </Button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={onFileChange}
      />

      {/* Painting picker dialog */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Choose a painting as the cover</DialogTitle>
          </DialogHeader>
          {loadingPaintings ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : paintings.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              This section has no paintings with images yet.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 max-h-[60vh] overflow-y-auto py-1 sm:grid-cols-4">
              {paintings.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => choosePainting(p)}
                  className="group relative aspect-square overflow-hidden rounded-md border border-border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  title={p.title}
                >
                  <Image
                    src={p.primary_image_url}
                    alt={p.title}
                    fill
                    sizes="120px"
                    className="object-cover transition-transform group-hover:scale-105"
                  />
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Crop dialog */}
      <Dialog
        open={!!imageSrc}
        onOpenChange={(open) => {
          if (!open && !saving) setImageSrc(null)
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="w-full max-w-[calc(100%-2rem)] sm:max-w-2xl p-0 gap-0 flex flex-col overflow-hidden"
        >
          <DialogHeader className="px-4 pt-4 pb-3 shrink-0 border-b border-border">
            <DialogTitle>Adjust cover — drag & zoom</DialogTitle>
          </DialogHeader>

          <div className="relative w-full h-[60dvh] sm:h-[400px] bg-black overflow-hidden shrink-0">
            {imageSrc && (
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={COVER_ASPECT}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_a, pixels) => setCroppedAreaPixels(pixels)}
              />
            )}
          </div>

          <div className="px-4 py-3 shrink-0 border-t border-border">
            <label className="text-xs text-muted-foreground mb-1 block">Zoom</label>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full accent-foreground"
            />
          </div>

          {error && <p className="px-4 pb-2 text-xs text-destructive shrink-0">{error}</p>}

          <DialogFooter className="shrink-0 rounded-none border-t px-4 py-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setImageSrc(null)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="button" onClick={saveCrop} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? "Saving…" : "Save cover"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
