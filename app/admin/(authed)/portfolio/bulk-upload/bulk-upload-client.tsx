"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useDropzone } from "react-dropzone"
import Image from "next/image"
import { toast } from "sonner"
import {
  X,
  Loader2,
  AlertCircle,
  RefreshCw,
  Upload,
  FolderOpen,
} from "lucide-react"
import { uploadImage, UploadError } from "@/lib/storage/upload"
import {
  bulkCreatePaintings,
  type BulkCreateItem,
} from "@/lib/actions/paintings"
import { cleanFilename, cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FormField } from "@/components/admin/form-field"
import { TagInput } from "@/components/admin/tag-input"
import { MarkdownEditor } from "@/components/admin/markdown-editor"
import { ConfirmDialog } from "@/components/admin/confirm-dialog"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import type { Section } from "@/lib/types"

// ─── Types ────────────────────────────────────────────────────────────────────

type CardStatus = "queued" | "uploading" | "ready" | "error"

interface BulkCard {
  id: string
  file: File
  previewUrl: string
  status: CardStatus
  uploadUrl: string | null
  uploadPath: string | null
  // Natural pixel size of the chosen file, measured in the browser. Saved with
  // the painting so the gallery lays the card out at its true shape.
  width: number | null
  height: number | null
  error: string | null
  title: string
  sectionId: string
  paintingStatus: "available" | "sold" | "nfs" | "reserved"
  year: string
  medium: string
  dimensions: string
  price: string
  story: string
  tags: string[]
  printAvailable: boolean
  commissionAvailable: boolean
}

function makeCard(file: File, defaultSectionId: string): BulkCard {
  return {
    id: crypto.randomUUID(),
    file,
    previewUrl: URL.createObjectURL(file),
    status: "queued",
    uploadUrl: null,
    uploadPath: null,
    width: null,
    height: null,
    error: null,
    title: cleanFilename(file.name),
    sectionId: defaultSectionId,
    paintingStatus: "available",
    year: "",
    medium: "",
    dimensions: "",
    price: "",
    story: "",
    tags: [],
    printAvailable: false,
    commissionAvailable: false,
  }
}

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"]
const MAX_CONCURRENT = 4

// ─── Details form (mounted fresh per card via key) ────────────────────────────

interface DetailsFormProps {
  card: BulkCard
  sections: Section[]
  onSave: (updates: Partial<BulkCard>) => void
}

function DetailsForm({ card, sections, onSave }: DetailsFormProps) {
  const [title, setTitle] = useState(card.title)
  const [paintingStatus, setPaintingStatus] = useState(card.paintingStatus)
  const [sectionId, setSectionId] = useState(card.sectionId)
  const [year, setYear] = useState(card.year)
  const [medium, setMedium] = useState(card.medium)
  const [dimensions, setDimensions] = useState(card.dimensions)
  const [price, setPrice] = useState(card.price)
  const [story, setStory] = useState(card.story)
  const [tags, setTags] = useState(card.tags)
  const [printAvailable, setPrintAvailable] = useState(card.printAvailable)
  const [commissionAvailable, setCommissionAvailable] = useState(
    card.commissionAvailable
  )

  function handleSave() {
    onSave({
      title,
      paintingStatus,
      sectionId,
      year,
      medium,
      dimensions,
      price,
      story,
      tags,
      printAvailable,
      commissionAvailable,
    })
  }

  return (
    <>
      <div className="space-y-4 py-2">
        <FormField label="Title">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Painting title"
          />
        </FormField>

        <FormField label="Section">
          <select
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
            className="w-full h-8 rounded-lg border border-input bg-background px-2.5 text-base md:text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Year">
            <Input
              type="number"
              min={1800}
              max={2100}
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="2024"
            />
          </FormField>
          <FormField label="Status">
            <select
              value={paintingStatus}
              onChange={(e) =>
                setPaintingStatus(
                  e.target.value as BulkCard["paintingStatus"]
                )
              }
              className="w-full h-8 rounded-lg border border-input bg-background px-2.5 text-base md:text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
            type="number"
            min={0}
            step={0.01}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="1500.00"
          />
        </FormField>

        <FormField label="Story">
          <MarkdownEditor
            value={story}
            onChange={setStory}
            placeholder="Tell the story of this painting…"
            rows={5}
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
            <span className="text-sm">
              Offer a similar painting on commission
            </span>
          </label>
        </div>
      </div>

      <DialogFooter>
        <Button onClick={handleSave}>Done</Button>
      </DialogFooter>
    </>
  )
}

// ─── Single card ──────────────────────────────────────────────────────────────

interface CardProps {
  card: BulkCard
  sections: Section[]
  onUpdate: (id: string, updates: Partial<BulkCard>) => void
  onRemove: (id: string) => void
  onRetry: (id: string) => void
  onDetails: (id: string) => void
}

function BulkCardItem({
  card,
  sections,
  onUpdate,
  onRemove,
  onRetry,
  onDetails,
}: CardProps) {
  const imgSrc = card.uploadUrl ?? card.previewUrl

  return (
    <div
      className={cn(
        "relative flex flex-col border border-border bg-card overflow-hidden",
        card.status === "error" && "border-destructive"
      )}
    >
      {/* Thumbnail */}
      <div className="relative aspect-square bg-muted overflow-hidden">
        <Image
          src={imgSrc}
          alt={card.title}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          className="object-cover"
          unoptimized={imgSrc.startsWith("blob:")}
        />

        {/* Status overlay */}
        {card.status === "uploading" || card.status === "queued" ? (
          <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-foreground" />
          </div>
        ) : card.status === "error" ? (
          <div className="absolute inset-0 bg-destructive/20 flex flex-col items-center justify-center gap-2 p-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <p className="text-xs text-destructive text-center leading-tight">
              {card.error}
            </p>
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-xs px-2"
              onClick={() => onRetry(card.id)}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Retry
            </Button>
          </div>
        ) : null}

        {/* Remove button */}
        <button
          type="button"
          onClick={() => onRemove(card.id)}
          className="absolute top-1.5 right-1.5 h-5 w-5 flex items-center justify-center bg-background/80 hover:bg-background border border-border text-foreground/60 hover:text-foreground transition-colors"
          aria-label="Remove image"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Editable fields */}
      <div className="p-2 space-y-1.5">
        <input
          type="text"
          value={card.title}
          onChange={(e) => onUpdate(card.id, { title: e.target.value })}
          className="w-full text-xs font-medium bg-transparent border-0 border-b border-transparent focus:border-border focus:outline-none px-0 py-0.5 truncate"
          placeholder="Title"
        />

        <select
          value={card.sectionId}
          onChange={(e) => onUpdate(card.id, { sectionId: e.target.value })}
          className="w-full text-xs bg-transparent border border-input rounded px-1.5 py-0.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>

        <select
          value={card.paintingStatus}
          onChange={(e) =>
            onUpdate(card.id, {
              paintingStatus: e.target.value as BulkCard["paintingStatus"],
            })
          }
          className="w-full text-xs bg-transparent border border-input rounded px-1.5 py-0.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="available">Available</option>
          <option value="sold">Sold</option>
          <option value="nfs">Not for sale</option>
          <option value="reserved">Reserved</option>
        </select>

        <Button
          variant="ghost"
          size="sm"
          className="w-full h-6 text-xs text-muted-foreground"
          onClick={() => onDetails(card.id)}
          disabled={card.status === "uploading" || card.status === "queued"}
        >
          Details…
        </Button>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface BulkUploadClientProps {
  sections: Section[]
  defaultSectionId: string
}

export function BulkUploadClient({
  sections,
  defaultSectionId,
}: BulkUploadClientProps) {
  const router = useRouter()
  const [cards, setCards] = useState<BulkCard[]>([])
  const [saving, setSaving] = useState(false)
  const [detailsCardId, setDetailsCardId] = useState<string | null>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  // Upload queue
// Reads the photo's natural pixel size in the browser. The bulk uploader sends
// the file untouched, so these are the dimensions of the stored image. Failure
// is not fatal — the gallery just falls back to its 4:3 guess, exactly as
// before.
async function measureImage(
  file: File
): Promise<{ width: number; height: number } | null> {
  const url = URL.createObjectURL(file)
  try {
    const dims = await new Promise<{ width: number; height: number } | null>(
      (resolve) => {
        const img = new window.Image()
        img.onload = () =>
          resolve({ width: img.naturalWidth, height: img.naturalHeight })
        img.onerror = () => resolve(null)
        img.src = url
      }
    )
    return dims && dims.width > 0 && dims.height > 0 ? dims : null
  } finally {
    URL.revokeObjectURL(url)
  }
}

  const uploadQueueRef = useRef<Array<{ cardId: string; file: File }>>([])
  const activeCountRef = useRef(0)
  // Ref so async uploadOneFile can call drain without a stale closure
  const drainQueueRef = useRef<() => void>(() => {})

  // Stable callback — only closes over refs/constants + setCards (stable)
  const uploadOneFile = useCallback(async (cardId: string, file: File) => {
    setCards((prev) =>
      prev.map((c) =>
        c.id === cardId ? { ...c, status: "uploading" as const } : c
      )
    )
    try {
      const [result, dims] = await Promise.all([
        uploadImage("paintings", file),
        measureImage(file),
      ])
      setCards((prev) =>
        prev.map((c) =>
          c.id === cardId
            ? {
                ...c,
                status: "ready" as const,
                uploadUrl: result.url,
                uploadPath: result.path,
                width: dims?.width ?? null,
                height: dims?.height ?? null,
              }
            : c
        )
      )
    } catch (e) {
      let msg = "Upload failed"
      if (e instanceof UploadError) {
        if (e.kind === "size") msg = "Too large (10 MB max)"
        else if (e.kind === "type") msg = "Must be JPEG, PNG, or WebP"
      }
      setCards((prev) =>
        prev.map((c) =>
          c.id === cardId
            ? { ...c, status: "error" as const, error: msg }
            : c
        )
      )
    } finally {
      activeCountRef.current--
      drainQueueRef.current()
    }
  }, []) // setCards, uploadImage, UploadError, activeCountRef, drainQueueRef are all stable

  // Stable callback — depends only on stable uploadOneFile
  const drainQueue = useCallback(() => {
    while (
      activeCountRef.current < MAX_CONCURRENT &&
      uploadQueueRef.current.length > 0
    ) {
      const job = uploadQueueRef.current.shift()!
      activeCountRef.current++
      void uploadOneFile(job.cardId, job.file)
    }
  }, [uploadOneFile])

  // Keep the ref in sync so uploadOneFile's finally always calls the latest drain
  useEffect(() => {
    drainQueueRef.current = drainQueue
  }, [drainQueue])

  const enqueueFiles = useCallback(
    (files: File[]) => {
      const images = files.filter((f) => ACCEPTED_TYPES.includes(f.type))
      if (images.length === 0) return
      const newCards = images.map((f) => makeCard(f, defaultSectionId))
      setCards((prev) => [...prev, ...newCards])
      uploadQueueRef.current.push(
        ...newCards.map((c) => ({ cardId: c.id, file: c.file }))
      )
      drainQueue()
    },
    [defaultSectionId, drainQueue]
  )

  const onDrop = useCallback(
    (acceptedFiles: File[]) => enqueueFiles(acceptedFiles),
    [enqueueFiles]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/jpeg": [], "image/png": [], "image/webp": [] },
    multiple: true,
    noClick: cards.length > 0,
  })

  function handleFolderPick(e: React.ChangeEvent<HTMLInputElement>) {
    enqueueFiles(Array.from(e.target.files ?? []))
    // Reset so the same folder can be re-selected
    e.target.value = ""
  }

  function updateCard(id: string, updates: Partial<BulkCard>) {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)))
  }

  async function removeCard(cardId: string) {
    const card = cards.find((c) => c.id === cardId)
    if (!card) return

    URL.revokeObjectURL(card.previewUrl)

    if (card.uploadPath) {
      await fetch("/api/admin/delete-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: card.uploadPath, bucket: "paintings" }),
      }).catch(() => {})
    }

    setCards((prev) => prev.filter((c) => c.id !== cardId))
    if (detailsCardId === cardId) setDetailsCardId(null)
  }

  function retryCard(cardId: string) {
    const card = cards.find((c) => c.id === cardId)
    if (!card || card.status !== "error") return
    updateCard(cardId, { status: "queued", error: null })
    uploadQueueRef.current.push({ cardId, file: card.file })
    drainQueue()
  }

  async function handleSaveAll() {
    const readyCards = cards.filter((c) => c.status === "ready")
    if (readyCards.length === 0) return

    setSaving(true)
    toast.loading(
      `Saving ${readyCards.length} painting${readyCards.length !== 1 ? "s" : ""}…`,
      { id: "bulk-save" }
    )

    const items: BulkCreateItem[] = readyCards.map((c) => ({
      title: c.title,
      section_id: c.sectionId,
      primary_image_url: c.uploadUrl,
      status: c.paintingStatus,
      year: c.year || undefined,
      medium: c.medium || undefined,
      dimensions: c.dimensions || undefined,
      price_dollars: c.price || undefined,
      story: c.story || undefined,
      print_available: c.printAvailable,
      commission_available: c.commissionAvailable,
      tags: c.tags,
      width: c.width,
      height: c.height,
    }))

    const result = await bulkCreatePaintings(items)

    if (!result.ok) {
      toast.error(result.error ?? "Failed to save paintings", {
        id: "bulk-save",
      })
      setSaving(false)
      return
    }

    toast.success(
      `${result.count} painting${result.count !== 1 ? "s" : ""} added.`,
      { id: "bulk-save" }
    )

    cards.forEach((c) => URL.revokeObjectURL(c.previewUrl))

    const target = result.sectionSlug
      ? `/admin/portfolio/${result.sectionSlug}`
      : "/admin/portfolio"
    router.push(target)
  }

  async function handleCancel() {
    const toDelete = cards.filter((c) => c.uploadPath)
    await Promise.allSettled(
      toDelete.map((c) =>
        fetch("/api/admin/delete-upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: c.uploadPath, bucket: "paintings" }),
        })
      )
    )
    cards.forEach((c) => URL.revokeObjectURL(c.previewUrl))
    setCards([])
    setDetailsCardId(null)
  }

  // Revoke preview URLs on unmount
  useEffect(() => {
    return () => {
      cards.forEach((c) => URL.revokeObjectURL(c.previewUrl))
    }
    // intentionally only on unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const readyCount = cards.filter((c) => c.status === "ready").length
  const uploadingCount = cards.filter(
    (c) => c.status === "uploading" || c.status === "queued"
  ).length
  const errorCount = cards.filter((c) => c.status === "error").length
  const hasCards = cards.length > 0
  const detailsCard = cards.find((c) => c.id === detailsCardId) ?? null

  return (
    <div className={cn("space-y-6", hasCards && "pb-28")}>
      {/* Drop zone — always visible, shrinks to an add-more strip when cards exist */}
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed transition-colors cursor-pointer",
          hasCards
            ? "rounded-lg p-4 text-center"
            : "rounded-xl p-12 md:p-20 text-center",
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/40 hover:bg-muted/40"
        )}
      >
        <input {...getInputProps()} />
        <div
          className={cn(
            "flex flex-col items-center gap-2 text-muted-foreground",
            hasCards && "flex-row justify-center gap-3"
          )}
        >
          <Upload
            className={cn("shrink-0", hasCards ? "h-4 w-4" : "h-8 w-8")}
          />
          <div className={cn(hasCards ? "text-sm" : "space-y-1")}>
            {hasCards ? (
              <span>Drop more images or click to select</span>
            ) : (
              <>
                <p className="text-base font-medium text-foreground">
                  Drop images here or click to select
                </p>
                <p className="text-sm">
                  You can also drag a whole folder, or{" "}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      folderInputRef.current?.click()
                    }}
                    className="underline underline-offset-2 hover:text-foreground transition-colors"
                  >
                    pick a folder
                  </button>
                </p>
                <p className="text-xs">JPEG, PNG, WebP</p>
              </>
            )}
          </div>
          {hasCards && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                folderInputRef.current?.click()
              }}
              className="shrink-0 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
            >
              <FolderOpen className="h-3.5 w-3.5" />
              Folder
            </button>
          )}
        </div>
      </div>

      {/* Hidden folder input — webkitdirectory lets the user pick a whole folder */}
      <input
        ref={folderInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        webkitdirectory=""
        className="sr-only"
        onChange={handleFolderPick}
      />

      {/* Card grid */}
      {hasCards && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {cards.map((card) => (
            <BulkCardItem
              key={card.id}
              card={card}
              sections={sections}
              onUpdate={updateCard}
              onRemove={removeCard}
              onRetry={retryCard}
              onDetails={setDetailsCardId}
            />
          ))}
        </div>
      )}

      {/* Details dialog */}
      <Dialog
        open={!!detailsCard}
        onOpenChange={(open) => {
          if (!open) setDetailsCardId(null)
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Painting details</DialogTitle>
          </DialogHeader>
          {detailsCard && (
            <DetailsForm
              key={detailsCard.id}
              card={detailsCard}
              sections={sections}
              onSave={(updates) => {
                updateCard(detailsCard.id, updates)
                setDetailsCardId(null)
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Sticky bottom bar */}
      {hasCards && (
        <div className="fixed bottom-0 inset-x-0 z-50 border-t border-border bg-card shadow-lg px-4 py-3">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-3">
            {/* Status counts */}
            <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="font-medium">
                {readyCount} painting{readyCount !== 1 ? "s" : ""} ready to save
              </span>
              {uploadingCount > 0 && (
                <span className="text-muted-foreground flex items-center gap-1">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {uploadingCount} uploading
                </span>
              )}
              {errorCount > 0 && (
                <span className="text-destructive">
                  {errorCount} failed
                </span>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <ConfirmDialog
                trigger={
                  <Button variant="outline" size="sm" disabled={saving}>
                    Cancel
                  </Button>
                }
                title="Discard this upload batch?"
                description={`${cards.length} photo${cards.length !== 1 ? "s" : ""} and any details you've entered will be discarded. This can't be undone.`}
                destructive
                confirmLabel="Discard"
                onConfirm={handleCancel}
              />
              <Button
                size="sm"
                onClick={handleSaveAll}
                disabled={saving || readyCount === 0}
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                {saving ? "Saving…" : `Save ${readyCount > 0 ? readyCount : ""} painting${readyCount !== 1 ? "s" : ""}`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
