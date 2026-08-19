"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Loader2, Sparkles } from "lucide-react"
import {
  createPainting,
  updatePainting,
  addPaintingImage,
  deletePaintingImage,
  reorderPaintingImages,
} from "@/lib/actions/paintings"
import { generatePaintingStory } from "@/lib/actions/ai"
import { updatePaintingTags } from "@/lib/actions/tags"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { FormField } from "@/components/admin/form-field"
import { ConfirmDialog } from "@/components/admin/confirm-dialog"
import { ImageUploadCropper } from "@/components/admin/image-upload-cropper"
import { MultiImageUpload } from "@/components/admin/multi-image-upload"
import { MarkdownEditor } from "@/components/admin/markdown-editor"
import { TagInput } from "@/components/admin/tag-input"
import { Checkbox } from "@/components/ui/checkbox"
import { slugify } from "@/lib/utils"
import type { PaintingWithImages, Section } from "@/lib/types"

interface MultiImageItem {
  id: string
  url: string
}

interface PaintingFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sectionId: string
  painting?: PaintingWithImages
  defaultTags?: string[]
  sections?: Section[]
  /** Whether the story_public/story_notes migration is applied (enables the AI story writer). */
  storyToolsEnabled?: boolean
}

export function PaintingFormDialog({
  open,
  onOpenChange,
  sectionId,
  painting,
  defaultTags = [],
  sections = [],
  storyToolsEnabled = false,
}: PaintingFormDialogProps) {
  const isEdit = !!painting

  const [activeSectionId, setActiveSectionId] = useState(painting?.section_id ?? sectionId)
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
  const [storyNotes, setStoryNotes] = useState(painting?.story_notes ?? "")
  const [storyPublic, setStoryPublic] = useState(painting?.story_public ?? true)
  const [storyDraft, setStoryDraft] = useState<string | null>(null)
  const [storyGenerating, setStoryGenerating] = useState(false)
  const [primaryUrl, setPrimaryUrl] = useState<string | null>(
    painting?.primary_image_url ?? null
  )
  const [additionalImages, setAdditionalImages] = useState<MultiImageItem[]>(
    (painting?.painting_images ?? []).map((img) => ({
      id: img.id,
      url: img.url,
    }))
  )
  const [tags, setTags] = useState<string[]>(defaultTags)
  const [printAvailable, setPrintAvailable] = useState(painting?.print_available ?? false)
  const [commissionAvailable, setCommissionAvailable] = useState(painting?.commission_available ?? false)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  function handleTitleChange(value: string) {
    setTitle(value)
    if (!slugManual) setSlug(slugify(value))
  }

  async function handleGenerateStory() {
    if (!storyNotes.trim()) return
    setStoryGenerating(true)
    setStoryDraft(null)
    try {
      const result = await generatePaintingStory({
        notes: storyNotes,
        title: title || null,
        medium: medium || null,
        dimensions: dimensions || null,
        year: year || null,
      })
      if (!result.ok) {
        toast.error(result.error, { duration: 5000 })
        return
      }
      setStoryDraft(result.story ?? null)
    } finally {
      setStoryGenerating(false)
    }
  }

  function applyStoryDraft() {
    if (storyDraft == null) return
    setStory(storyDraft)
    setStoryDraft(null)
    toast.success("Story updated — remember to save", { duration: 5000 })
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
        section_id: activeSectionId,
        title,
        slug,
        year: year ? year : undefined,
        medium: medium || null,
        dimensions: dimensions || null,
        price_dollars: price || undefined,
        status: status as "available" | "sold" | "nfs" | "reserved",
        story: story || null,
        story_public: storyPublic,
        story_notes: storyNotes || null,
        primary_image_url: primaryUrl,
        print_available: printAvailable,
        commission_available: commissionAvailable,
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

        // Sync tags
        await updatePaintingTags(painting.id, tags)

        toast.success("Painting saved")
        onOpenChange(false)
      } else {
        const result = await createPainting(input)
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        const newId = result.data?.id
        if (newId) {
          if (additionalImages.length > 0) {
            for (const img of additionalImages) {
              await addPaintingImage(newId, { url: img.url })
            }
          }
          if (tags.length > 0) {
            await updatePaintingTags(newId, tags)
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
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
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
                className="w-full h-8 rounded-lg border border-input bg-background px-2.5 text-base md:text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="available">Available</option>
                <option value="sold">Sold</option>
                <option value="nfs">Not for sale</option>
                <option value="reserved">Reserved</option>
              </select>
            </FormField>
          </div>

          {sections.length > 0 && (
            <FormField label="Section">
              <select
                value={activeSectionId}
                onChange={(e) => setActiveSectionId(e.target.value)}
                className="w-full h-8 rounded-lg border border-input bg-background px-2.5 text-base md:text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </select>
            </FormField>
          )}

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

          {storyToolsEnabled ? (
            <div className="space-y-3 rounded-xl border border-border p-3">
              <FormField
                label="Your notes"
                className="space-y-1"
              >
                <Textarea
                  value={storyNotes}
                  onChange={(e) => setStoryNotes(e.target.value)}
                  placeholder='e.g. "glow but broken, damaged, looking into the centre, decayed tiles"'
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Jot down words, feelings, whatever you were thinking. This is
                  just for you — visitors never see it.
                </p>
              </FormField>

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!storyNotes.trim() || storyGenerating}
                onClick={handleGenerateStory}
              >
                {storyGenerating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                )}
                {storyGenerating ? "Writing…" : "Write it for me"}
              </Button>

              {storyDraft != null && (
                <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3">
                  <p className="text-sm leading-relaxed">{storyDraft}</p>
                  <div className="flex flex-wrap gap-2">
                    {story.trim() ? (
                      <ConfirmDialog
                        trigger={
                          <Button type="button" size="sm" variant="default">
                            Replace story
                          </Button>
                        }
                        title="Replace the existing story?"
                        description="This will overwrite the Story field below with the AI suggestion. You can still edit it by hand afterward."
                        confirmLabel="Replace"
                        onConfirm={async () => {
                          applyStoryDraft()
                        }}
                      />
                    ) : (
                      <Button type="button" size="sm" onClick={applyStoryDraft}>
                        Use this
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={storyGenerating}
                      onClick={handleGenerateStory}
                    >
                      Try again
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setStoryDraft(null)}
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              )}

              <FormField label="Story">
                <MarkdownEditor
                  value={story}
                  onChange={setStory}
                  placeholder="Tell the story of this painting…"
                  rows={6}
                />
              </FormField>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <Checkbox
                  checked={storyPublic}
                  onCheckedChange={(v) => setStoryPublic(!!v)}
                />
                <span className="text-sm">Show this story on the website</span>
              </label>
              <p className="text-xs text-muted-foreground -mt-2 ml-[26px]">
                Turn this off to keep the story private — you&rsquo;ll still see
                it here.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <FormField label="Story">
                <MarkdownEditor
                  value={story}
                  onChange={setStory}
                  placeholder="Tell the story of this painting…"
                  rows={6}
                />
              </FormField>
              <p className="text-xs text-muted-foreground">
                This feature needs a quick one-time setup that hasn&rsquo;t
                run yet — everything else works normally.
              </p>
            </div>
          )}

          <FormField label="Primary image">
            <ImageUploadCropper
              bucket="paintings"
              currentImageUrl={primaryUrl}
              aspectRatio="free"
              label="Primary image"
              onUploadComplete={(url) => setPrimaryUrl(url)}
            />
          </FormField>

          <FormField label="Additional images">
            <MultiImageUpload
              bucket="paintings"
              value={additionalImages}
              onChange={setAdditionalImages}
            />
          </FormField>

          <FormField label="Tags">
            <TagInput value={tags} onChange={setTags} />
          </FormField>

          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <Checkbox
                checked={printAvailable}
                onCheckedChange={(v) => setPrintAvailable(!!v)}
              />
              <span className="text-sm">Print available</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <Checkbox
                checked={commissionAvailable}
                onCheckedChange={(v) => setCommissionAvailable(!!v)}
              />
              <span className="text-sm">Available on commission</span>
            </label>
          </div>
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
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create painting"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
