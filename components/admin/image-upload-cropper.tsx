"use client"

import { useEffect, useRef, useState } from "react"
import { useDropzone } from "react-dropzone"
import Image from "next/image"
import { Loader2, Upload, Images, Pencil } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { MediaPickerDialog } from "@/components/admin/media-picker-dialog"
import { ImageEditorDialog } from "@/components/admin/image-editor-dialog"
import { cn } from "@/lib/utils"
import { IMAGE_PRESETS, type PresetKey } from "@/lib/image-presets"
import {
  IDENTITY_RECIPE,
  isIdentityRecipe,
  loadImageDims,
  parsePublicStorageUrl,
  renderEdit,
  type EditRecipe,
} from "@/lib/image-edit"
import {
  checkImageEditsEnabled,
  getImageEdit,
  recordImageEdit,
} from "@/lib/actions/image-edits"

const MAX_FILE_BYTES = 20 * 1024 * 1024 // 20 MB

export interface UploadCompleteResult {
  url: string
  width: number
  height: number
}

interface Props {
  currentImageUrl?: string | null
  preset: PresetKey
  onUploadComplete: (result: UploadCompleteResult | null) => void
  label?: string
  className?: string
  /** Show the "Choose from library" button. Defaults to true — set false to avoid nesting (e.g. inside the library's own uploader). */
  libraryEnabled?: boolean
  /** Physical width/height ratio nudge (design plan IE-4/A1) — forwarded to ImageEditorDialog. */
  physicalRatio?: number | null
  /** Display label for the physical size, e.g. "24 × 36 in" — forwarded to ImageEditorDialog. */
  physicalDimsLabel?: string | null
}

function publicStorageUrl(bucket: string, path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  return `${base}/storage/v1/object/public/${bucket}/${path}`
}

function readAsDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error("Failed to read file"))
    reader.readAsDataURL(file)
  })
}

// Supabase public buckets send access-control-allow-origin:*, so this
// fetch→blob round trip doesn't taint the canvas.
async function fetchAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url)
  const blob = await res.blob()
  return readAsDataUrl(blob)
}

type EditSource = { bucket: string; path: string }

export function ImageUploadCropper({
  currentImageUrl,
  preset: presetKey,
  onUploadComplete,
  label,
  className,
  libraryEnabled = true,
  physicalRatio,
  physicalDimsLabel,
}: Props) {
  const preset = IMAGE_PRESETS[presetKey]
  const fieldLabel = label ?? preset.label

  const [localUrl, setLocalUrl] = useState<string | null>(currentImageUrl ?? null)
  const [uploading, setUploading] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [editEnabled, setEditEnabled] = useState(false)

  // Editor dialog state — shared between "fresh upload / crop" and "re-edit
  // an already-saved image" flows.
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editorSrc, setEditorSrc] = useState<string | null>(null)
  const [initialRecipe, setInitialRecipe] = useState<EditRecipe | null>(null)
  // Present only in "edit an existing image" mode — where the untouched
  // original lives, so a re-edit is lossless and Revert has somewhere to go.
  const [editSource, setEditSource] = useState<EditSource | null>(null)
  const [editSourceDims, setEditSourceDims] = useState<{ width: number; height: number } | null>(
    null
  )

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    checkImageEditsEnabled().then(setEditEnabled).catch(() => setEditEnabled(false))
  }, [])

  async function uploadBlob(blob: Blob, folder?: "crops"): Promise<{ url: string; path: string }> {
    const formData = new FormData()
    formData.append("file", blob, "image.jpg")
    formData.append("bucket", preset.bucket)
    if (folder) formData.append("folder", folder)
    const res = await fetch("/api/admin/upload", { method: "POST", body: formData })
    const json = (await res.json()) as { url?: string; path?: string; error?: string }
    if (!res.ok || !json.url || !json.path) throw new Error(json.error ?? "Upload failed")
    return { url: json.url, path: json.path }
  }

  function closeDialog() {
    setDialogOpen(false)
    setEditorSrc(null)
    setInitialRecipe(null)
    setEditSource(null)
    setEditSourceDims(null)
  }

  // ---- Fresh file selection ----

  async function processFile(file: File) {
    if (file.size > MAX_FILE_BYTES) {
      toast.error("File must be under 20 MB", { duration: 5000 })
      return
    }
    const dataUrl = await readAsDataUrl(file)

    if (preset.ratio === "free") {
      // "Free" presets skip the crop dialog entirely — compress and upload
      // the untouched original immediately.
      setUploading(true)
      try {
        const rendered = await renderEdit(dataUrl, IDENTITY_RECIPE, preset.maxOutputPx)
        const { url } = await uploadBlob(rendered.blob)
        setLocalUrl(url)
        toast.success("Image uploaded", { duration: 5000 })
        onUploadComplete({ url, width: rendered.width, height: rendered.height })
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Upload failed", { duration: 5000 })
      } finally {
        setUploading(false)
      }
      return
    }

    // Fixed aspect ratio — open the shared editor. No original exists in
    // storage yet, so save-time uploads BOTH the untouched original and the
    // cropped derivative (non-destructive from the very first upload).
    setEditorSrc(dataUrl)
    setInitialRecipe(null)
    setEditSource(null)
    setEditSourceDims(null)
    setDialogOpen(true)
  }

  async function handlePick(url: string, bucket: string, path: string) {
    if (preset.ratio === "free") {
      // Free fields reuse the picked image by reference (no re-upload), but
      // still need its true pixel size — read it via the same CORS-safe
      // fetch→blob round trip used everywhere else in this component.
      setLocalUrl(url)
      toast.success("Image selected", { duration: 5000 })
      try {
        const dims = await loadImageDims(await fetchAsDataUrl(url))
        onUploadComplete({ url, width: dims.width, height: dims.height })
      } catch {
        onUploadComplete({ url, width: 0, height: 0 })
      }
      return
    }

    try {
      const dataUrl = await fetchAsDataUrl(url)
      setEditorSrc(dataUrl)
      setInitialRecipe(null)
      // The picked file is itself the source — a fresh derivative renders
      // into this field's own bucket, but points back at wherever the
      // picked file actually lives.
      setEditSource({ bucket, path })
      setEditSourceDims(null)
      setDialogOpen(true)
    } catch {
      toast.error("Couldn't load that image — try another", { duration: 5000 })
    }
  }

  // ---- Editor save (covers fresh upload, library pick, and re-edit) ----

  async function handleEditorSave(result: {
    blob: Blob
    recipe: EditRecipe
    width: number
    height: number
  }) {
    if (!editorSrc) return
    setUploading(true)
    try {
      if (editSource) {
        // Re-editing (or cropping a library pick) — the original already
        // exists somewhere; only upload the new derivative.
        if (isIdentityRecipe(result.recipe)) {
          // Nothing changed — point straight at the original, no new file.
          const url = publicStorageUrl(editSource.bucket, editSource.path)
          const dims = editSourceDims ?? { width: result.width, height: result.height }
          setLocalUrl(url)
          closeDialog()
          onUploadComplete({ url, width: dims.width, height: dims.height })
          toast.success("Photo updated", { duration: 5000 })
          return
        }
        const { url, path } = await uploadBlob(result.blob, "crops")
        const recordResult = await recordImageEdit({
          bucket: preset.bucket,
          path,
          source_bucket: editSource.bucket,
          source_path: editSource.path,
          recipe: result.recipe,
        })
        if (!recordResult.ok && editEnabled) {
          // Non-fatal — the derivative is saved either way, but log for the owner.
          toast.error(recordResult.error, { duration: 5000 })
        }
        setLocalUrl(url)
        closeDialog()
        onUploadComplete({ url, width: result.width, height: result.height })
        toast.success("Photo updated", { duration: 5000 })
      } else {
        // Fresh upload with a crop — nothing exists in storage yet, so save
        // both the untouched original (root) and the cropped derivative (crops/).
        const original = await renderEdit(editorSrc, IDENTITY_RECIPE, preset.maxOutputPx)
        const orig = await uploadBlob(original.blob)
        const derivative = await uploadBlob(result.blob, "crops")
        await recordImageEdit({
          bucket: preset.bucket,
          path: derivative.path,
          source_bucket: preset.bucket,
          source_path: orig.path,
          recipe: result.recipe,
        })
        setLocalUrl(derivative.url)
        closeDialog()
        onUploadComplete({ url: derivative.url, width: result.width, height: result.height })
        toast.success("Image uploaded", { duration: 5000 })
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed", { duration: 5000 })
    } finally {
      setUploading(false)
    }
  }

  // ---- Edit affordance on an already-saved image ----

  async function openEditExisting() {
    if (!editEnabled || !localUrl || uploading) return
    const parsed = parsePublicStorageUrl(localUrl)
    if (!parsed) {
      toast.error("Can't edit this image — try Replace instead", { duration: 5000 })
      return
    }

    const existing = await getImageEdit(parsed.bucket, parsed.path)
    let source: EditSource
    let recipe: EditRecipe | null
    if (existing.ok && existing.data) {
      source = { bucket: existing.data.source_bucket, path: existing.data.source_path }
      recipe = existing.data.recipe
    } else {
      // No recorded original — treat the current file as the source. One
      // more lossy hop this time, lossless on every re-edit after.
      source = parsed
      recipe = null
    }

    try {
      const sourceUrl = publicStorageUrl(source.bucket, source.path)
      const dataUrl = await fetchAsDataUrl(sourceUrl)
      const img = new window.Image()
      img.src = dataUrl
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error("Failed to load image"))
      })
      setEditorSrc(dataUrl)
      setInitialRecipe(recipe)
      setEditSource(source)
      setEditSourceDims({ width: img.naturalWidth, height: img.naturalHeight })
      setDialogOpen(true)
    } catch {
      toast.error("Couldn't load that image — try another", { duration: 5000 })
    }
  }

  function handleRevert() {
    if (!editSource || !editSourceDims) return
    const url = publicStorageUrl(editSource.bucket, editSource.path)
    setLocalUrl(url)
    closeDialog()
    onUploadComplete({ url, width: editSourceDims.width, height: editSourceDims.height })
    toast.success("Photo updated", { duration: 5000 })
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

  function openPicker() {
    fileInputRef.current?.click()
  }

  function onFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    e.target.value = ""
  }

  const previewPaddingBottom =
    preset.ratio !== "free" ? `${(1 / preset.ratio) * 100}%` : undefined

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {localUrl ? (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={editEnabled ? openEditExisting : undefined}
            className={cn(
              "relative overflow-hidden bg-muted w-full max-w-[280px] text-left",
              editEnabled && "cursor-pointer"
            )}
            style={previewPaddingBottom ? { paddingBottom: previewPaddingBottom } : { height: 160 }}
          >
            <Image
              src={localUrl}
              alt={fieldLabel}
              fill
              className="object-cover"
              sizes="280px"
            />
          </button>
          <div className="flex flex-wrap gap-2">
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
            {editEnabled && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={openEditExisting}
                disabled={uploading}
              >
                <Pencil className="h-3.5 w-3.5 mr-1" />
                Edit
              </Button>
            )}
            {libraryEnabled && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPickerOpen(true)}
                disabled={uploading}
              >
                <Images className="h-3.5 w-3.5 mr-1" />
                Choose from library
              </Button>
            )}
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
          <div className="mt-3 flex justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={openPicker}
              disabled={uploading}
            >
              <Upload className="h-3.5 w-3.5 mr-1" />
              Select file
            </Button>
            {libraryEnabled && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPickerOpen(true)}
                disabled={uploading}
              >
                <Images className="h-3.5 w-3.5 mr-1" />
                Choose from library
              </Button>
            )}
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={onFileInputChange}
      />

      {preset.hint && <p className="text-xs text-muted-foreground max-w-[280px]">{preset.hint}</p>}

      {libraryEnabled && (
        <MediaPickerDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          initialBucket={preset.bucket}
          onPick={(url, bucket, path) => {
            setPickerOpen(false)
            handlePick(url, bucket, path)
          }}
        />
      )}

      <ImageEditorDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open && !uploading) closeDialog()
        }}
        src={editorSrc}
        preset={preset}
        initialRecipe={initialRecipe}
        physicalRatio={physicalRatio}
        physicalDimsLabel={physicalDimsLabel}
        onSave={handleEditorSave}
        saving={uploading}
        onRevert={editSource && initialRecipe ? handleRevert : undefined}
        title={editSource ? `Edit ${fieldLabel}` : `Crop ${fieldLabel}`}
      />
    </div>
  )
}
