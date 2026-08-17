"use client"

import { MediaGrid, type BucketFilter } from "@/components/admin/media-grid"
import type { MediaItem } from "@/lib/actions/media"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface MediaPickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPick: (url: string, bucket: MediaItem["bucket"], path: string) => void
  /** Bucket tab to open on — typically the field's own bucket. */
  initialBucket?: BucketFilter
}

export function MediaPickerDialog({
  open,
  onOpenChange,
  onPick,
  initialBucket = "all",
}: MediaPickerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-[calc(100%-2rem)] sm:max-w-3xl max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Choose an image</DialogTitle>
        </DialogHeader>
        <MediaGrid
          initialBucket={initialBucket}
          onSelect={(item) => {
            onPick(item.url, item.bucket, item.path)
            onOpenChange(false)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
