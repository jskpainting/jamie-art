"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { format } from "date-fns"
import { toast } from "sonner"
import { Loader2, Upload, Copy, Trash2, Pencil } from "lucide-react"
import {
  deleteMedia,
  getMediaUsage,
  replaceImageUrl,
  type MediaBucket,
  type MediaItem,
  type MediaUsage,
} from "@/lib/actions/media"
import { checkImageEditsEnabled, getImageEdit, recordImageEdit } from "@/lib/actions/image-edits"
import { MediaGrid, formatBytes } from "@/components/admin/media-grid"
import { ConfirmDialog } from "@/components/admin/confirm-dialog"
import { ImageUploadCropper } from "@/components/admin/image-upload-cropper"
import { ImageEditorDialog } from "@/components/admin/image-editor-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { IMAGE_PRESETS, type PresetKey } from "@/lib/image-presets"
import { isIdentityRecipe, type EditRecipe } from "@/lib/image-edit"

// Which editor preset a library item opens with, keyed by its own bucket.
const EDIT_PRESET_BY_BUCKET: Record<MediaBucket, PresetKey> = {
  paintings: "paintingExtra",
  headshots: "headshot",
  events: "event",
  "site-images": "siteImage",
}

function buildStorageUrl(bucket: string, path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  return `${base}/storage/v1/object/public/${bucket}/${path}`
}

async function fetchAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url)
  const blob = await res.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error("Failed to read image"))
    reader.readAsDataURL(blob)
  })
}

interface FollowUp {
  oldUrl: string
  newUrl: string
  usage: MediaUsage[]
}

export function MediaLibraryClient() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [uploadOpen, setUploadOpen] = useState(0) // remount key; 0 = closed
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [selected, setSelected] = useState<MediaItem | null>(null)
  const [followUp, setFollowUp] = useState<FollowUp | null>(null)
  const [applyingFollowUp, setApplyingFollowUp] = useState(false)

  function handleUploaded() {
    setUploadDialogOpen(false)
    setUploadOpen((k) => k + 1)
    setRefreshKey((k) => k + 1)
  }

  function handleEdited(info: FollowUp) {
    setRefreshKey((k) => k + 1)
    if (info.newUrl !== info.oldUrl && info.usage.length > 0) {
      setFollowUp(info)
    }
  }

  async function handleUseEverywhere() {
    if (!followUp) return
    setApplyingFollowUp(true)
    try {
      const result = await replaceImageUrl(followUp.oldUrl, followUp.newUrl)
      if (!result.ok) {
        toast.error(result.error ?? "Failed to update", { duration: 5000 })
        return
      }
      toast.success(
        `Updated in ${result.replaced} place${result.replaced === 1 ? "" : "s"}`,
        { duration: 5000 }
      )
      setFollowUp(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update", { duration: 5000 })
    } finally {
      setApplyingFollowUp(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setUploadDialogOpen(true)}>
          <Upload className="h-3.5 w-3.5 mr-1" />
          Upload new
        </Button>
      </div>

      <MediaGrid onSelect={setSelected} refreshKey={refreshKey} showToolbar />

      {/* Upload dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Upload a new image</DialogTitle>
          </DialogHeader>
          <ImageUploadCropper
            key={uploadOpen}
            preset="siteImage"
            label="Image"
            libraryEnabled={false}
            onUploadComplete={(result) => {
              if (result) handleUploaded()
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Detail / edit / delete dialog */}
      {selected && (
        <MediaDetailDialog
          key={`${selected.bucket}/${selected.path}`}
          item={selected}
          onClose={() => setSelected(null)}
          onDeleted={() => {
            setSelected(null)
            setRefreshKey((k) => k + 1)
          }}
          onEdited={handleEdited}
        />
      )}

      {/* "Use it everywhere" follow-up */}
      <Dialog open={!!followUp} onOpenChange={(o) => !o && !applyingFollowUp && setFollowUp(null)}>
        <DialogContent className="sm:max-w-sm" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Use the new version everywhere?</DialogTitle>
          </DialogHeader>
          {followUp && (
            <p className="text-sm text-muted-foreground">
              This photo appears on: {followUp.usage.map((u) => u.label).join(", ")}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFollowUp(null)}
              disabled={applyingFollowUp}
            >
              Just save it to my library
            </Button>
            <Button onClick={handleUseEverywhere} disabled={applyingFollowUp} className="gap-2">
              {applyingFollowUp && <Loader2 className="h-4 w-4 animate-spin" />}
              Use it everywhere
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function MediaDetailDialog({
  item,
  onClose,
  onDeleted,
  onEdited,
}: {
  item: MediaItem
  onClose: () => void
  onDeleted: () => void
  onEdited: (info: FollowUp) => void
}) {
  const [usageState, setUsageState] = useState<"loading" | "ok" | "error">("loading")
  const [usage, setUsage] = useState<MediaUsage[]>([])

  const [editEnabled, setEditEnabled] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorSrc, setEditorSrc] = useState<string | null>(null)
  const [initialRecipe, setInitialRecipe] = useState<EditRecipe | null>(null)
  const [editSource, setEditSource] = useState<{ bucket: string; path: string } | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    getMediaUsage(item.url)
      .then((res) => {
        if (cancelled) return
        if (res.ok) {
          setUsage(res.data)
          setUsageState("ok")
        } else {
          setUsageState("error")
        }
      })
      .catch(() => {
        if (!cancelled) setUsageState("error")
      })
    return () => {
      cancelled = true
    }
  }, [item.url])

  useEffect(() => {
    checkImageEditsEnabled().then(setEditEnabled).catch(() => setEditEnabled(false))
  }, [])

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(item.url)
      toast.success("Link copied", { duration: 5000 })
    } catch {
      toast.error("Couldn't copy link", { duration: 5000 })
    }
  }

  async function openEdit() {
    if (!editEnabled || saving) return
    try {
      const existing = await getImageEdit(item.bucket, item.path)
      let source: { bucket: string; path: string }
      let recipe: EditRecipe | null
      if (existing.ok && existing.data) {
        source = { bucket: existing.data.source_bucket, path: existing.data.source_path }
        recipe = existing.data.recipe
      } else {
        // No recorded original — edit the current file as the source. One
        // more lossy hop this time, lossless on every re-edit after.
        source = { bucket: item.bucket, path: item.path }
        recipe = null
      }
      const dataUrl = await fetchAsDataUrl(buildStorageUrl(source.bucket, source.path))
      setEditSource(source)
      setInitialRecipe(recipe)
      setEditorSrc(dataUrl)
      setEditorOpen(true)
    } catch {
      toast.error("Couldn't load that image — try again", { duration: 5000 })
    }
  }

  function closeEditor() {
    setEditorOpen(false)
    setEditorSrc(null)
    setInitialRecipe(null)
    setEditSource(null)
  }

  async function handleEditorSave(result: {
    blob: Blob
    recipe: EditRecipe
    width: number
    height: number
  }) {
    if (!editSource) return
    setSaving(true)
    try {
      let newUrl: string
      if (isIdentityRecipe(result.recipe)) {
        // Nothing changed — point straight at the original, no new file.
        newUrl = buildStorageUrl(editSource.bucket, editSource.path)
      } else {
        const formData = new FormData()
        formData.append("file", result.blob, "image.jpg")
        formData.append("bucket", item.bucket)
        formData.append("folder", "crops")
        const res = await fetch("/api/admin/upload", { method: "POST", body: formData })
        const json = (await res.json()) as { url?: string; path?: string; error?: string }
        if (!res.ok || !json.url || !json.path) throw new Error(json.error ?? "Upload failed")

        const recordResult = await recordImageEdit({
          bucket: item.bucket,
          path: json.path,
          source_bucket: editSource.bucket,
          source_path: editSource.path,
          recipe: result.recipe,
        })
        if (!recordResult.ok) throw new Error(recordResult.error)
        newUrl = json.url
      }

      closeEditor()
      toast.success("Photo updated", { duration: 5000 })
      onEdited({ oldUrl: item.url, newUrl, usage })
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save edit", { duration: 5000 })
    } finally {
      setSaving(false)
    }
  }

  function handleRevert() {
    if (!editSource) return
    const url = buildStorageUrl(editSource.bucket, editSource.path)
    closeEditor()
    toast.success("Photo updated", { duration: 5000 })
    onEdited({ oldUrl: item.url, newUrl: url, usage })
    onClose()
  }

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Image details</DialogTitle>
          </DialogHeader>

          <div className="relative w-full aspect-square bg-muted border border-border overflow-hidden">
            <Image src={item.url} alt="" fill sizes="480px" className="object-contain" />
          </div>

          <div className="text-xs text-muted-foreground space-y-1">
            <p>
              {item.createdAt ? format(new Date(item.createdAt), "MMM d, yyyy") : "Unknown date"}
              {" · "}
              {formatBytes(item.size)}
              {" · "}
              {item.bucket}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.15em] font-medium text-muted-foreground">
              Used on
            </p>
            {usageState === "loading" ? (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Checking…
              </p>
            ) : usageState === "error" ? (
              <p className="text-sm text-destructive">
                Couldn&apos;t check where this image is used — delete is disabled until this
                succeeds.
              </p>
            ) : usage.length > 0 ? (
              <ul className="text-sm space-y-1">
                {usage.map((u, i) => (
                  <li key={i}>
                    <Link href={u.adminHref} className="underline hover:text-foreground">
                      {u.label}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Not used anywhere yet.</p>
            )}
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={handleCopyLink}>
              <Copy className="h-3.5 w-3.5 mr-1" />
              Copy link
            </Button>
            {editEnabled && (
              <Button type="button" variant="outline" size="sm" onClick={openEdit}>
                <Pencil className="h-3.5 w-3.5 mr-1" />
                Edit photo
              </Button>
            )}
            <ConfirmDialog
              trigger={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  disabled={usageState !== "ok" || usage.length > 0}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Delete
                </Button>
              }
              title="Delete image"
              description="This image will be permanently removed from storage. This can't be undone."
              destructive
              onConfirm={async () => {
                const result = await deleteMedia(item.bucket, item.path)
                if (!result.ok) {
                  throw new Error(result.error ?? "Failed to delete image")
                }
                toast.success("Image deleted", { duration: 5000 })
                onDeleted()
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      <ImageEditorDialog
        open={editorOpen}
        onOpenChange={(open) => {
          if (!open && !saving) closeEditor()
        }}
        src={editorSrc}
        preset={IMAGE_PRESETS[EDIT_PRESET_BY_BUCKET[item.bucket]]}
        initialRecipe={initialRecipe}
        onSave={handleEditorSave}
        saving={saving}
        onRevert={initialRecipe ? handleRevert : undefined}
        title="Edit photo"
      />
    </>
  )
}
