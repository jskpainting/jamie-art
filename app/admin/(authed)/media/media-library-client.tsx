"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { format } from "date-fns"
import { toast } from "sonner"
import { Loader2, Upload, Copy, Trash2 } from "lucide-react"
import { deleteMedia, getMediaUsage, type MediaItem, type MediaUsage } from "@/lib/actions/media"
import { MediaGrid, formatBytes } from "@/components/admin/media-grid"
import { ConfirmDialog } from "@/components/admin/confirm-dialog"
import { ImageUploadCropper } from "@/components/admin/image-upload-cropper"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function MediaLibraryClient() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [uploadOpen, setUploadOpen] = useState(0) // remount key; 0 = closed
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [selected, setSelected] = useState<MediaItem | null>(null)

  function handleUploaded() {
    setUploadDialogOpen(false)
    setUploadOpen((k) => k + 1)
    setRefreshKey((k) => k + 1)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setUploadDialogOpen(true)}>
          <Upload className="h-3.5 w-3.5 mr-1" />
          Upload new
        </Button>
      </div>

      <MediaGrid onSelect={setSelected} refreshKey={refreshKey} />

      {/* Upload dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Upload a new image</DialogTitle>
          </DialogHeader>
          <ImageUploadCropper
            key={uploadOpen}
            bucket="site-images"
            aspectRatio="free"
            label="Image"
            libraryEnabled={false}
            onUploadComplete={(url) => {
              if (url) handleUploaded()
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Detail / delete dialog */}
      {selected && (
        <MediaDetailDialog
          key={selected.path}
          item={selected}
          onClose={() => setSelected(null)}
          onDeleted={() => {
            setSelected(null)
            setRefreshKey((k) => k + 1)
          }}
        />
      )}
    </div>
  )
}

function MediaDetailDialog({
  item,
  onClose,
  onDeleted,
}: {
  item: MediaItem
  onClose: () => void
  onDeleted: () => void
}) {
  const [usageState, setUsageState] = useState<"loading" | "ok" | "error">("loading")
  const [usage, setUsage] = useState<MediaUsage[]>([])

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

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(item.url)
      toast.success("Link copied", { duration: 5000 })
    } catch {
      toast.error("Couldn't copy link", { duration: 5000 })
    }
  }

  return (
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
  )
}
