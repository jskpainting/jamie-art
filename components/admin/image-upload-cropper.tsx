"use client"

import { useState, useRef } from "react"
import { useDropzone } from "react-dropzone"
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
import { cn } from "@/lib/utils"

const MAX_FILE_BYTES = 20 * 1024 * 1024 // 20 MB
const MAX_OUTPUT_PX = 4000

type Bucket = "headshots" | "paintings" | "events" | "site-images"

interface Props {
  currentImageUrl?: string | null
  aspectRatio?: number | "free"
  bucket: Bucket
  onUploadComplete: (url: string | null) => void
  label?: string
  className?: string
}

// Compress (and optionally crop) an image data-URL to a JPEG Blob.
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

  if (srcW < 1 || srcH < 1) {
    throw new Error("Crop area is too small — try zooming out")
  }

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
      (b) =>
        b
          ? resolve(b)
          : reject(new Error("Image conversion failed — try a different file")),
      "image/jpeg",
      0.95
    )
  )
}

export function ImageUploadCropper({
  currentImageUrl,
  aspectRatio = "free",
  bucket,
  onUploadComplete,
  label = "Image",
  className,
}: Props) {
  const [localUrl, setLocalUrl] = useState<string | null>(currentImageUrl ?? null)
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  async function uploadBlob(blob: Blob): Promise<string> {
    const formData = new FormData()
    formData.append("file", blob, "image.jpg")
    formData.append("bucket", bucket)
    const res = await fetch("/api/admin/upload", { method: "POST", body: formData })
    const json = (await res.json()) as { url?: string; error?: string }
    if (!res.ok) throw new Error(json.error ?? "Upload failed")
    return json.url!
  }

  function readAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error("Failed to read file"))
      reader.readAsDataURL(file)
    })
  }

  async function processFile(file: File) {
    if (file.size > MAX_FILE_BYTES) {
      toast.error("File must be under 20 MB", { duration: 5000 })
      return
    }

    const dataUrl = await readAsDataUrl(file)

    if (aspectRatio === "free") {
      // Skip crop dialog — compress and upload immediately
      setUploading(true)
      try {
        const blob = await compress(dataUrl)
        const url = await uploadBlob(blob)
        setLocalUrl(url)
        onUploadComplete(url)
        toast.success("Image uploaded", { duration: 5000 })
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Upload failed", { duration: 5000 })
      } finally {
        setUploading(false)
      }
    } else {
      setImageSrc(dataUrl)
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      setCroppedAreaPixels(null)
      setUploadError(null)
      setDialogOpen(true)
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => {
      const file = files[0]
      if (file) processFile(file)
    },
    accept: { "image/jpeg": [], "image/png": [], "image/webp": [] },
    maxFiles: 1,
    disabled: uploading,
    noClick: true,
    noKeyboard: true,
  })

  async function handleSave() {
    if (!imageSrc || !croppedAreaPixels) return
    setUploading(true)
    setUploadError(null)
    try {
      const blob = await compress(imageSrc, croppedAreaPixels)
      const url = await uploadBlob(blob)
      setLocalUrl(url)
      setDialogOpen(false)
      setImageSrc(null)
      toast.success("Image uploaded", { duration: 5000 })
      onUploadComplete(url)
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  function handleCancel() {
    if (uploading) return
    setDialogOpen(false)
    setImageSrc(null)
    setUploadError(null)
  }

  function openPicker() {
    fileInputRef.current?.click()
  }

  function onFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    e.target.value = ""
  }

  // Aspect ratio for the existing image preview (padding-bottom trick)
  const previewPaddingBottom =
    aspectRatio !== "free"
      ? `${(1 / (aspectRatio as number)) * 100}%`
      : undefined

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {localUrl ? (
        <div className="flex flex-col gap-2">
          <div
            className="relative overflow-hidden bg-muted w-full max-w-[280px]"
            style={previewPaddingBottom ? { paddingBottom: previewPaddingBottom } : { height: 160 }}
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
              onClick={openPicker}
              disabled={uploading}
            >
              {uploading && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
              Replace
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setLocalUrl(null)
                onUploadComplete(null)
              }}
              disabled={uploading}
            >
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <div
          {...getRootProps()}
          className={cn(
            "border-2 border-dashed rounded-lg p-6 text-center transition-colors w-full max-w-[280px]",
            isDragActive
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 hover:bg-muted/50",
            uploading && "pointer-events-none opacity-60"
          )}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            {uploading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <Upload className="h-6 w-6" />
            )}
            <p className="text-sm">
              {uploading
                ? "Uploading…"
                : isDragActive
                ? "Drop image here"
                : "Drag & drop or click to select"}
            </p>
            <p className="text-xs">JPEG, PNG, WebP · max 20 MB</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={openPicker}
            disabled={uploading}
          >
            <Upload className="h-3.5 w-3.5 mr-1" />
            Select file
          </Button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={onFileInputChange}
      />

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open && !uploading) handleCancel()
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="w-full max-w-[calc(100%-2rem)] sm:max-w-2xl p-0 gap-0 h-[100dvh] sm:h-auto flex flex-col overflow-hidden"
        >
          <DialogHeader className="px-4 pt-4 pb-3 shrink-0 border-b border-border">
            <DialogTitle>Crop {label}</DialogTitle>
          </DialogHeader>

          {/*
            Fixed explicit height — this is the root fix for Bug B.
            The previous component used flex-1 inside sm:h-auto which collapsed
            to 0px, giving a 0×0 canvas and a null toBlob.
          */}
          <div className="relative w-full h-[60dvh] sm:h-[400px] bg-black overflow-hidden shrink-0">
            {imageSrc && (
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={aspectRatio as number}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_area, pixels) => setCroppedAreaPixels(pixels)}
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

          {uploadError && (
            <p className="px-4 pb-2 text-xs text-destructive shrink-0">{uploadError}</p>
          )}

          <DialogFooter className="shrink-0 rounded-none border-t px-4 py-3">
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
