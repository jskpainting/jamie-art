"use client"

import { useState } from "react"
import { toast } from "sonner"
import {
  createPainting,
  updatePainting,
  addPaintingImage,
  deletePaintingImage,
  reorderPaintingImages,
} from "@/lib/actions/paintings"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FormField } from "@/components/admin/form-field"
import { ImageUpload } from "@/components/admin/image-upload"
import { MultiImageUpload } from "@/components/admin/multi-image-upload"
import { MarkdownEditor } from "@/components/admin/markdown-editor"
import { slugify } from "@/lib/utils"
import type { PaintingWithImages } from "@/lib/types"

interface MultiImageItem {
  id: string
  url: string
}

interface PaintingFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sectionId: string
  painting?: PaintingWithImages
}

export function PaintingFormDialog({
  open,
  onOpenChange,
  sectionId,
  painting,
}: PaintingFormDialogProps) {
  const isEdit = !!painting

  const [title, setTitle] = useState(painting?.title ?? "")
  const [slug, setSlug] = useState(painting?.slug ?? "")
  const [slugManual, setSlugManual] = useState(isEdit)
  // Auto-derive slug from title when not manually edited
  const [year, setYear] = useState(painting?.year?.toString() ?? "")
  const [medium, setMedium] = useState(painting?.medium ?? "")
  const [dimensions, setDimensions] = useState(painting?.dimensions ?? "")
  const [price, setPrice] = useState(
    painting?.price_cents != null
      ? (painting.price_cents / 100).toFixed(2)
      : ""
  )
  const [status, setStatus] = useState<string>(painting?.status ?? "available")
  const [story, setStory] = useState(painting?.story ?? "")
  const [primaryUrl, setPrimaryUrl] = useState<string | null>(
    painting?.primary_image_url ?? null
  )
  const [additionalImages, setAdditionalImages] = useState<MultiImageItem[]>(
    (painting?.painting_images ?? []).map((img) => ({
      id: img.id,
      url: img.url,
    }))
  )
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  function handleTitleChange(value: string) {
    setTitle(value)
    if (!slugManual) setSlug(slugify(value))
  }

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!title.trim()) errs.title = "Title is required"
    if (!slug.trim()) errs.slug = "Slug is required"
    else if (!/^[a-z0-9-]+$/.test(slug))
      errs.slug = "Lowercase letters, numbers, and hyphens only"
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSave() {
    if (!validate()) return
    setSaving(true)
    try {
      const input = {
        section_id: sectionId,
        title,
        slug,
        year: year ? year : undefined,
        medium: medium || null,
        dimensions: dimensions || null,
        price_dollars: price || undefined,
        status: status as "available" | "sold" | "nfs" | "reserved",
        story: story || null,
        primary_image_url: primaryUrl,
      }

      if (isEdit) {
        const result = await updatePainting(painting.id, input)
        if (!result.ok) {
          toast.error(result.error)
          return
        }

        // Sync additional images: remove deleted, add new, reorder
        const existingIds = new Set(
          painting.painting_images.map((img) => img.id)
        )
        const newImageIds = new Set(additionalImages.map((img) => img.id))

        // Delete removed images
        for (const img of painting.painting_images) {
          if (!newImageIds.has(img.id)) {
            await deletePaintingImage(img.id)
          }
        }

        // Add new images (those whose id doesn't exist in DB)
        for (const img of additionalImages) {
          if (!existingIds.has(img.id)) {
            await addPaintingImage(painting.id, { url: img.url })
          }
        }

        // Reorder existing images
        const existingInOrder = additionalImages
          .filter((img) => existingIds.has(img.id))
          .map((img) => img.id)
        if (existingInOrder.length > 0) {
          await reorderPaintingImages(painting.id, existingInOrder)
        }

        toast.success("Painting saved")
        onOpenChange(false)
      } else {
        const result = await createPainting(input)
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        const newId = result.data?.id
        if (newId && additionalImages.length > 0) {
          for (const img of additionalImages) {
            await addPaintingImage(newId, { url: img.url })
          }
        }
        toast.success("Painting created")
        onOpenChange(false)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit painting" : "Add painting"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <FormField label="Title" required error={errors.title}>
            <Input
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Painting title"
            />
          </FormField>

          <FormField label="Slug" required error={errors.slug}>
            <Input
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value)
                setSlugManual(true)
              }}
              placeholder="url-friendly-slug"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Year">
              <Input
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="2024"
                type="number"
                min={1800}
                max={2100}
              />
            </FormField>
            <FormField label="Status">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full h-8 rounded-lg border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="available">Available</option>
                <option value="sold">Sold</option>
                <option value="nfs">Not for sale</option>
                <option value="reserved">Reserved</option>
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Medium">
              <Input
                value={medium}
                onChange={(e) => setMedium(e.target.value)}
                placeholder="Oil on canvas"
              />
            </FormField>
            <FormField label="Dimensions">
              <Input
                value={dimensions}
                onChange={(e) => setDimensions(e.target.value)}
                placeholder='24" × 36"'
              />
            </FormField>
          </div>

          <FormField label="Price (USD)">
            <Input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="1500.00"
              type="number"
              min={0}
              step={0.01}
            />
          </FormField>

          <FormField label="Story">
            <MarkdownEditor
              value={story}
              onChange={setStory}
              placeholder="Tell the story of this painting…"
              rows={6}
            />
          </FormField>

          <FormField label="Primary image">
            <ImageUpload
              bucket="paintings"
              value={primaryUrl}
              onChange={setPrimaryUrl}
            />
          </FormField>

          <FormField label="Additional images">
            <MultiImageUpload
              bucket="paintings"
              value={additionalImages}
              onChange={setAdditionalImages}
            />
          </FormField>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create painting"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
