"use client"

import { useState, useRef, useCallback } from "react"
import Cropper from "react-easy-crop"
import type { Area } from "react-easy-crop"
import "react-easy-crop/react-easy-crop.css"
import Image from "next/image"
import { Loader2, Upload } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { updateSettingImage } from "@/lib/actions/settings"

export type ImageField = "home_hero_image_url" | "about_image_url" | "commission_image_url"

interface Props {
  label: string
  aspectRatio: number
  currentImageUrl: string | null
  bucket: "headshots" | "site-images"
  field: ImageField
  hintText?: string
}

async function getCanvasBlob(imageSrc: string, pixelCrop: Area, maxDim = 2000): Promise<Blob> {
  const img = new window.Image()
  img.src = imageSrc
  await new Promise<void>((resolve) => {
    img.onload = () => resolve()
  })

  const scale = Math.min(1, maxDim / Math.max(pixelCrop.width, pixelCrop.height))
  const outW = Math.round(pixelCrop.width * scale)
  const outH = Math.round(pixelCrop.height * scale)

  const canvas = document.createElement("canvas")
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext("2d")!
  ctx.drawImage(
    img,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outW,
    outH
  )

  return new Promise<Blob>((res, rej) =>
    canvas.toBlob(
      (b) => (b ? res(b) : rej(new Error("Canvas toBlob returned null"))),
      "image/jpeg",
      0.9
    )
  )
}

export function ImageCropUploader({
  label,
  aspectRatio,
  currentImageUrl,
  bucket,
  field,
  hintText,
}: Props) {
  const [localUrl, setLocalUrl] = useState<string | null>(currentImageUrl)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const onCropComplete = useCallback((_croppedArea: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels)
  }, [])

  function openFilePicker() {
    fileInputRef.current?.click()
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setImageSrc(reader.result as string)
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      setUploadError(null)
      setDialogOpen(true)
    }
    reader.readAsDataURL(file)
    e.target.value = ""
  }

  async function handleSave() {
    if (!imageSrc || !croppedAreaPixels) return
    setUploading(true)
    setUploadError(null)
    try {
      const blob = await getCanvasBlob(imageSrc, croppedAreaPixels)
      const formData = new FormData()
      formData.append("file", blob, "crop.jpg")
      formData.append("bucket", bucket)

      const res = await fetch("/api/admin/upload", { method: "POST", body: formData })
      const json = (await res.json()) as { url?: string; error?: string }
      if (!res.ok) throw new Error(json.error ?? "Upload failed")

      const result = await updateSettingImage(field, json.url!)
      if (!result.ok) throw new Error(result.error ?? "Save failed")

      setLocalUrl(json.url!)
      setDialogOpen(false)
      setImageSrc(null)
      toast.success(`${label} saved.`)
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Something went wrong")
    } finally {
      setUploading(false)
    }
  }

  async function handleRemove() {
    const result = await updateSettingImage(field, null)
    if (!result.ok) {
      toast.error(result.error ?? "Failed to remove image.")
      return
    }
    setLocalUrl(null)
    toast.success(`${label} removed.`)
  }

  function handleCancel() {
    setDialogOpen(false)
    setImageSrc(null)
    setUploadError(null)
  }

  // aspect ratio = width / height → padding trick: 1/ar * 100%
  const paddingBottom = `${(1 / aspectRatio) * 100}%`

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hintText && (
          <p className="text-xs text-muted-foreground mt-0.5">{hintText}</p>
        )}
      </div>

      {localUrl ? (
        <div className="flex flex-col gap-2">
          <div
            className="relative overflow-hidden bg-muted w-full max-w-[280px]"
            style={{ paddingBottom }}
          >
            <Image
              src={localUrl}
              alt={label}
              fill
              className="object-cover"
              sizes="280px"
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={openFilePicker}
            >
              Replace
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemove}
            >
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-fit gap-2"
          onClick={openFilePicker}
        >
          <Upload className="h-4 w-4" />
          Upload {label}
        </Button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFileChange}
      />

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open && !uploading) handleCancel() }}>
        <DialogContent
          showCloseButton={false}
          className="w-full max-w-[calc(100%-2rem)] sm:max-w-2xl p-0 gap-0 h-[100dvh] sm:h-auto flex flex-col overflow-hidden"
        >
          <DialogHeader className="px-4 pt-4 pb-3 shrink-0 border-b border-border">
            <DialogTitle>Crop {label}</DialogTitle>
          </DialogHeader>

          {/* Crop canvas area */}
          <div className="relative w-full flex-1 sm:h-[400px] min-h-0 bg-black overflow-hidden">
            {imageSrc && (
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={aspectRatio}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            )}
          </div>

          {/* Zoom slider */}
          <div className="px-4 py-3 shrink-0 border-t border-border">
            <label className="text-xs text-muted-foreground mb-1 block">
              Zoom
            </label>
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

          {uploadError && (
            <p className="px-4 pb-2 text-xs text-destructive shrink-0">
              {uploadError}
            </p>
          )}

          <DialogFooter className="shrink-0 rounded-none border-t">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={uploading}
              className="gap-2"
            >
              {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
              {uploading ? "Saving…" : "Save crop"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
