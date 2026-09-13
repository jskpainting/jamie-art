"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Loader2, Sparkles, ChevronDown, ChevronRight, Box, Search, X } from "lucide-react"
import { parsePhysical } from "@/lib/mosaic-layout"
import { WallFitPreview } from "@/components/admin/wall-fit-preview"
import {
  createPainting,
  updatePainting,
  addPaintingImage,
  deletePaintingImage,
  reorderPaintingImages,
  regenerateArModel,
} from "@/lib/actions/paintings"
import { generatePaintingStory } from "@/lib/actions/ai"
import { updatePaintingTags, getAllTags } from "@/lib/actions/tags"
import { getFieldOptions, touchFieldOptions } from "@/lib/actions/field-options"
import {
  searchContacts,
  findOrCreateContact,
  addPurchase,
  type ContactSearchResult,
} from "@/lib/actions/crm"
import type { FieldOptionField } from "@/lib/field-options"
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
import { TagPicker } from "@/components/admin/tag-picker"
import { OptionSelect } from "@/components/admin/option-select"
import { Checkbox } from "@/components/ui/checkbox"
import { slugify } from "@/lib/utils"
import type { Painting, PaintingWithImages, Section } from "@/lib/types"

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
  /** Other paintings already in this section — scale reference for the wall preview. */
  neighbors?: Painting[]
  /** Whether the contact_groups (CRM) migration is applied (enables "Sold to"). */
  crmEnabled?: boolean
}

export function PaintingFormDialog({
  open,
  onOpenChange,
  sectionId,
  painting,
  defaultTags = [],
  sections = [],
  storyToolsEnabled = false,
  neighbors = [],
  crmEnabled = false,
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
  const [primaryWidth, setPrimaryWidth] = useState<number | null>(painting?.width ?? null)
  const [primaryHeight, setPrimaryHeight] = useState<number | null>(painting?.height ?? null)
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
  const [wallPreviewOpen, setWallPreviewOpen] = useState(false)
  const [rebuildingAr, setRebuildingAr] = useState(false)
  const [fieldOptions, setFieldOptions] = useState<Record<FieldOptionField, string[]>>({
    medium: [],
    dimensions: [],
  })
  const [allTags, setAllTags] = useState<string[]>([])

  // "Sold to" — optional, only shown when Status = Sold and the CRM migration is live.
  const [soldToContact, setSoldToContact] = useState<ContactSearchResult | null>(null)
  const [soldToQuery, setSoldToQuery] = useState("")
  const [soldToResults, setSoldToResults] = useState<ContactSearchResult[]>([])
  const [soldToOpen, setSoldToOpen] = useState(false)
  const [soldToAddNew, setSoldToAddNew] = useState(false)
  const [newPersonEmail, setNewPersonEmail] = useState("")
  const [newPersonName, setNewPersonName] = useState("")
  const soldToRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!soldToOpen) return
    const q = soldToQuery.trim()
    let cancelled = false
    const timer = setTimeout(async () => {
      if (q.length < 2) {
        if (!cancelled) setSoldToResults([])
        return
      }
      const result = await searchContacts(q)
      if (!cancelled && result.ok) setSoldToResults(result.results)
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [soldToQuery, soldToOpen])

  useEffect(() => {
    if (!soldToOpen) return
    function handleClick(e: MouseEvent) {
      if (soldToRef.current && !soldToRef.current.contains(e.target as Node)) {
        setSoldToOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [soldToOpen])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    getFieldOptions().then((result) => {
      if (cancelled || !result.ok) return
      setFieldOptions({
        medium: result.options.medium.map((o) => o.value),
        dimensions: result.options.dimensions.map((o) => o.value),
      })
    })
    getAllTags().then((result) => {
      if (cancelled || !result.ok) return
      setAllTags(result.tags.map((t) => t.name))
    })
    return () => {
      cancelled = true
    }
  }, [open])

  // Live-derived from `dimensions` so typing dimensions after uploading a
  // photo immediately lights up the shape check on re-edit (A1).
  const physicalDims = parsePhysical(dimensions)
  const physicalRatio = physicalDims ? physicalDims[0] / physicalDims[1] : null
  const physicalDimsLabel = physicalDims ? `${physicalDims[0]} × ${physicalDims[1]} in` : null
  const primaryImageAspect =
    primaryWidth && primaryHeight ? primaryWidth / primaryHeight : null

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

  async function handleRebuildArModel() {
    if (!painting) return
    setRebuildingAr(true)
    try {
      const result = await regenerateArModel(painting.id)
      if (!result.ok) {
        toast.error(result.error ?? "Couldn't rebuild the 3D model", { duration: 5000 })
        return
      }
      toast.success("3D model rebuilt", { duration: 5000 })
    } finally {
      setRebuildingAr(false)
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

  /**
   * Records the sale on the People side when "Sold to" was filled in.
   * Never blocks the painting save on failure — the painting itself already
   * saved successfully by the time this runs.
   */
  async function recordSoldTo(paintingId: string) {
    if (status !== "sold") return
    let contactId = soldToContact?.id ?? null

    if (!contactId && soldToAddNew && newPersonEmail.trim()) {
      const [first, ...rest] = newPersonName.trim().split(/\s+/)
      const created = await findOrCreateContact({
        email: newPersonEmail.trim(),
        first_name: newPersonName.trim() ? first : null,
        last_name: newPersonName.trim() && rest.length ? rest.join(" ") : null,
        source: "sale",
      })
      if (!created.ok) {
        toast.error(created.error, { duration: 5000 })
        return
      }
      contactId = created.id
    }

    if (!contactId) return

    const result = await addPurchase(contactId, { painting_id: paintingId, markSold: false })
    if (!result.ok) {
      toast.error(`Painting saved, but couldn't record the sale: ${result.error}`, {
        duration: 5000,
      })
    }
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
        width: primaryWidth,
        height: primaryHeight,
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
            const delResult = await deletePaintingImage(img.id)
            if (!delResult.ok) {
              toast.error(delResult.error ?? "Couldn't save part of this painting", {
                duration: 5000,
              })
              return
            }
          }
        }

        // Add new images (those whose id doesn't exist in DB)
        for (const img of additionalImages) {
          if (!existingIds.has(img.id)) {
            const addResult = await addPaintingImage(painting.id, { url: img.url })
            if (!addResult.ok) {
              toast.error(addResult.error ?? "Couldn't save part of this painting", {
                duration: 5000,
              })
              return
            }
          }
        }

        // Reorder existing images
        const existingInOrder = additionalImages
          .filter((img) => existingIds.has(img.id))
          .map((img) => img.id)
        if (existingInOrder.length > 0) {
          const reorderResult = await reorderPaintingImages(painting.id, existingInOrder)
          if (!reorderResult.ok) {
            toast.error(reorderResult.error ?? "Couldn't save part of this painting", {
              duration: 5000,
            })
            return
          }
        }

        // Sync tags
        const tagsResult = await updatePaintingTags(painting.id, tags)
        if (!tagsResult.ok) {
          toast.error(tagsResult.error ?? "Couldn't save part of this painting", {
            duration: 5000,
          })
          return
        }

        await touchFieldOptions({ medium, dimensions })

        if (crmEnabled) await recordSoldTo(painting.id)

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
              const addResult = await addPaintingImage(newId, { url: img.url })
              if (!addResult.ok) {
                toast.error(addResult.error ?? "Couldn't save part of this painting", {
                  duration: 5000,
                })
                return
              }
            }
          }
          if (tags.length > 0) {
            const tagsResult = await updatePaintingTags(newId, tags)
            if (!tagsResult.ok) {
              toast.error(tagsResult.error ?? "Couldn't save part of this painting", {
                duration: 5000,
              })
              return
            }
          }
        }

        await touchFieldOptions({ medium, dimensions })

        if (crmEnabled && newId) await recordSoldTo(newId)

        toast.success("Painting created")
        onOpenChange(false)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
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

          {status === "sold" && crmEnabled && (
            <FormField label="Sold to (optional)">
              {soldToContact ? (
                <div className="flex items-center gap-2 rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm">
                  <span className="flex-1 truncate">
                    {[soldToContact.first_name, soldToContact.last_name].filter(Boolean).join(" ") ||
                      soldToContact.email}
                    {soldToContact.first_name || soldToContact.last_name ? (
                      <span className="text-xs text-muted-foreground ml-1.5">{soldToContact.email}</span>
                    ) : null}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSoldToContact(null)}
                    aria-label="Clear selection"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : soldToAddNew ? (
                <div className="space-y-2 rounded-lg border border-input p-2.5">
                  <Input
                    value={newPersonEmail}
                    onChange={(e) => setNewPersonEmail(e.target.value)}
                    placeholder="email@example.com"
                    type="email"
                  />
                  <Input
                    value={newPersonName}
                    onChange={(e) => setNewPersonName(e.target.value)}
                    placeholder="Full name (optional)"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setSoldToAddNew(false)
                      setNewPersonEmail("")
                      setNewPersonName("")
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                  >
                    Search existing people instead
                  </button>
                </div>
              ) : (
                <div ref={soldToRef} className="relative">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      value={soldToQuery}
                      onChange={(e) => {
                        setSoldToQuery(e.target.value)
                        setSoldToOpen(true)
                      }}
                      onFocus={() => setSoldToOpen(true)}
                      placeholder="Search people by name or email…"
                      className="pl-8"
                    />
                  </div>
                  {soldToOpen && soldToQuery.trim().length >= 2 && (
                    <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border border-border bg-popover shadow-md max-h-56 overflow-y-auto">
                      {soldToResults.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setSoldToContact(c)
                            setSoldToOpen(false)
                            setSoldToQuery("")
                          }}
                          className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-muted"
                        >
                          <span>{[c.first_name, c.last_name].filter(Boolean).join(" ") || c.email}</span>
                          <span className="text-xs text-muted-foreground">{c.email}</span>
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          setSoldToAddNew(true)
                          setSoldToOpen(false)
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-primary hover:bg-muted border-t border-border"
                      >
                        + Add new person
                      </button>
                    </div>
                  )}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Records this as a purchase on their People page.
              </p>
            </FormField>
          )}

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
              <OptionSelect
                value={medium}
                onChange={setMedium}
                options={fieldOptions.medium}
                placeholder="Oil on canvas"
              />
            </FormField>
            <FormField label="Size">
              <OptionSelect
                value={dimensions}
                onChange={setDimensions}
                options={fieldOptions.dimensions}
                placeholder='24"x36"'
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
              <p className="text-xs text-muted-foreground -mt-2">
                Leave this as is and it&rsquo;s filled in automatically from
                the title, year, size, medium and price.
              </p>

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
                Leave this as is and it&rsquo;s filled in automatically from
                the title, year, size, medium and price.
              </p>
              <p className="text-xs text-muted-foreground">
                This feature needs a quick one-time setup that hasn&rsquo;t
                run yet — everything else works normally.
              </p>
            </div>
          )}

          <FormField label="Primary image">
            <ImageUploadCropper
              preset="painting"
              currentImageUrl={primaryUrl}
              label="Primary image"
              physicalRatio={physicalRatio}
              physicalDimsLabel={physicalDimsLabel}
              onUploadComplete={(result) => {
                setPrimaryUrl(result?.url ?? null)
                setPrimaryWidth(result?.width || null)
                setPrimaryHeight(result?.height || null)
              }}
            />
          </FormField>

          {primaryUrl && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setWallPreviewOpen((v) => !v)}
                  className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  {wallPreviewOpen ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                  See it on the wall
                </button>
                {isEdit && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={rebuildingAr}
                    onClick={handleRebuildArModel}
                  >
                    {rebuildingAr ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    ) : (
                      <Box className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Rebuild 3D model
                  </Button>
                )}
              </div>
              {wallPreviewOpen && (
                <WallFitPreview
                  imageUrl={primaryUrl}
                  imageAspect={primaryImageAspect}
                  dimensions={dimensions}
                  neighbors={neighbors}
                  excludeId={painting?.id ?? null}
                />
              )}
            </div>
          )}

          <FormField label="Additional images">
            <MultiImageUpload
              preset="paintingExtra"
              value={additionalImages}
              onChange={setAdditionalImages}
            />
          </FormField>

          <FormField label="Tags">
            <TagPicker value={tags} onChange={setTags} allTags={allTags} />
            <p className="text-xs text-muted-foreground">
              Paintings that share tags appear under &ldquo;Related
              work&rdquo; on each other&rsquo;s pages.
            </p>
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
              <span className="text-sm">
                Offer a similar painting on commission
              </span>
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
