"use client"

import { useState, useRef, useCallback, useEffect, useMemo } from "react"
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
  Camera,
  Info,
  Check,
} from "lucide-react"
import { uploadImage } from "@/lib/storage/upload"
import { explainUploadError, isHeicFile } from "@/lib/upload-errors"
import {
  bulkCreatePaintings,
  type BulkCreateItem,
} from "@/lib/actions/paintings"
import { getFieldOptions, touchFieldOptions } from "@/lib/actions/field-options"
import { getAllTags } from "@/lib/actions/tags"
import type { FieldOptionField } from "@/lib/field-options"
import { cleanFilename, cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FormField } from "@/components/admin/form-field"
import { TagPicker } from "@/components/admin/tag-picker"
import { OptionSelect } from "@/components/admin/option-select"
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

// ─── Constants ──────────────────────────────────────────────────────────────

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"]
const DEFAULTS_STORAGE_KEY = "bulk-upload:defaults:v1"
const DRAFT_STORAGE_KEY = "bulk-upload:draft:v1"
const JUNK_TITLE_RE = /^(img|image|photo|dsc|pxl|screenshot)[ _-]?\d*$/i

const MAX_CONCURRENT =
  typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches ? 2 : 4

type PaintingStatus = "available" | "sold" | "nfs" | "reserved"
type CardStatus = "queued" | "uploading" | "ready" | "error"

interface BulkCard {
  id: string
  // Null once restored from a saved draft (the file itself can't persist) —
  // such cards are always already `ready`.
  file: File | null
  previewUrl: string
  status: CardStatus
  progress: number
  uploadUrl: string | null
  uploadPath: string | null
  width: number | null
  height: number | null
  error: string | null
  errorDetail: string | null
  title: string
  sectionId: string
  paintingStatus: PaintingStatus
  year: string
  medium: string
  dimensions: string
  price: string
  story: string
  tags: string[]
  printAvailable: boolean
  commissionAvailable: boolean
}

interface BulkDefaults {
  sectionId: string
  paintingStatus: PaintingStatus
  year: string
  medium: string
  dimensions: string
  price: string
  tags: string[]
}

function needsTitleAttention(title: string): boolean {
  const t = title.trim()
  return t === "" || t.toLowerCase() === "untitled" || JUNK_TITLE_RE.test(t)
}

function titleFromFilename(filename: string): string {
  const stem = filename.replace(/\.[^.]+$/, "")
  if (JUNK_TITLE_RE.test(stem.trim())) return "Untitled"
  return cleanFilename(filename)
}

function makeCard(file: File, defaults: BulkDefaults): BulkCard {
  return {
    id: crypto.randomUUID(),
    file,
    previewUrl: URL.createObjectURL(file),
    status: "queued",
    progress: 0,
    uploadUrl: null,
    uploadPath: null,
    width: null,
    height: null,
    error: null,
    errorDetail: null,
    title: titleFromFilename(file.name),
    sectionId: defaults.sectionId,
    paintingStatus: defaults.paintingStatus,
    year: defaults.year,
    medium: defaults.medium,
    dimensions: defaults.dimensions,
    price: defaults.price,
    story: "",
    tags: defaults.tags,
    printAvailable: false,
    commissionAvailable: false,
  }
}

// ─── localStorage helpers ───────────────────────────────────────────────────

function loadDefaults(fallbackSectionId: string): BulkDefaults {
  const base: BulkDefaults = {
    sectionId: fallbackSectionId,
    paintingStatus: "available",
    year: "",
    medium: "",
    dimensions: "",
    price: "",
    tags: [],
  }
  if (typeof window === "undefined") return base
  try {
    const raw = window.localStorage.getItem(DEFAULTS_STORAGE_KEY)
    if (!raw) return base
    const parsed = JSON.parse(raw) as Partial<BulkDefaults>
    return {
      ...base,
      ...parsed,
      sectionId: parsed.sectionId || fallbackSectionId,
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
    }
  } catch {
    return base
  }
}

interface DraftCard {
  id: string
  uploadUrl: string
  uploadPath: string
  width: number | null
  height: number | null
  title: string
  sectionId: string
  paintingStatus: PaintingStatus
  year: string
  medium: string
  dimensions: string
  price: string
  story: string
  tags: string[]
  printAvailable: boolean
  commissionAvailable: boolean
}

function readDraft(): DraftCard[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as { cards?: DraftCard[] }
    return Array.isArray(parsed.cards) ? parsed.cards : []
  } catch {
    return []
  }
}

function writeDraft(cards: BulkCard[]) {
  if (typeof window === "undefined") return
  const ready: DraftCard[] = cards
    .filter((c): c is BulkCard & { uploadUrl: string; uploadPath: string } =>
      c.status === "ready" && !!c.uploadUrl && !!c.uploadPath
    )
    .map((c) => ({
      id: c.id,
      uploadUrl: c.uploadUrl,
      uploadPath: c.uploadPath,
      width: c.width,
      height: c.height,
      title: c.title,
      sectionId: c.sectionId,
      paintingStatus: c.paintingStatus,
      year: c.year,
      medium: c.medium,
      dimensions: c.dimensions,
      price: c.price,
      story: c.story,
      tags: c.tags,
      printAvailable: c.printAvailable,
      commissionAvailable: c.commissionAvailable,
    }))
  try {
    if (ready.length === 0) {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY)
    } else {
      window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ cards: ready }))
    }
  } catch {
    // localStorage full/unavailable — draft persistence is best-effort only.
  }
}

function draftCardToBulkCard(d: DraftCard): BulkCard {
  return {
    id: d.id,
    file: null,
    previewUrl: d.uploadUrl,
    status: "ready",
    progress: 100,
    uploadUrl: d.uploadUrl,
    uploadPath: d.uploadPath,
    width: d.width,
    height: d.height,
    error: null,
    errorDetail: null,
    title: d.title,
    sectionId: d.sectionId,
    paintingStatus: d.paintingStatus,
    year: d.year,
    medium: d.medium,
    dimensions: d.dimensions,
    price: d.price,
    story: d.story,
    tags: d.tags,
    printAvailable: d.printAvailable,
    commissionAvailable: d.commissionAvailable,
  }
}

// ─── Details form (mounted fresh per card via key) ────────────────────────────

interface DetailsFormProps {
  card: BulkCard
  sections: Section[]
  fieldOptions: Record<FieldOptionField, string[]>
  allTags: string[]
  onSave: (updates: Partial<BulkCard>) => void
  onApplyToAll: (field: FieldOptionField, value: string) => void
}

function DetailsForm({ card, sections, fieldOptions, allTags, onSave, onApplyToAll }: DetailsFormProps) {
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
            <OptionSelect
              value={medium}
              onChange={setMedium}
              options={fieldOptions.medium}
              placeholder="Oil on canvas"
            />
            {medium.trim() && (
              <button
                type="button"
                onClick={() => onApplyToAll("medium", medium)}
                className="mt-1 text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
              >
                Apply to all cards
              </button>
            )}
          </FormField>
          <FormField label="Size">
            <OptionSelect
              value={dimensions}
              onChange={setDimensions}
              options={fieldOptions.dimensions}
              placeholder='24"x36"'
            />
            {dimensions.trim() && (
              <button
                type="button"
                onClick={() => onApplyToAll("dimensions", dimensions)}
                className="mt-1 text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
              >
                Apply to all cards
              </button>
            )}
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
          <TagPicker value={tags} onChange={setTags} allTags={allTags} />
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
  onUpdate: (id: string, updates: Partial<BulkCard>) => void
  onRemove: (id: string) => void
  onRetry: (id: string) => void
  onDetails: (id: string) => void
}

function BulkCardItem({ card, onUpdate, onRemove, onRetry, onDetails }: CardProps) {
  const [showDetail, setShowDetail] = useState(false)
  const imgSrc = card.uploadUrl ?? card.previewUrl
  const busy = card.status === "uploading" || card.status === "queued"
  const flagTitle = needsTitleAttention(card.title)

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

        {/* Progress overlay while uploading */}
        {busy && (
          <div className="absolute inset-0 bg-background/60 flex flex-col items-center justify-center gap-1.5">
            <Loader2 className="h-6 w-6 animate-spin text-foreground" />
            {card.status === "uploading" && (
              <span className="text-xs font-medium text-foreground">{card.progress}%</span>
            )}
          </div>
        )}
        {busy && (
          <div className="absolute bottom-0 inset-x-0 h-1 bg-background/40">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${card.status === "uploading" ? card.progress : 0}%` }}
            />
          </div>
        )}

        {/* Error state */}
        {card.status === "error" && (
          <div className="absolute inset-0 bg-destructive/20 flex flex-col items-center justify-center gap-1.5 p-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <p className="text-xs text-destructive text-center leading-tight">
              {card.error}
              {card.errorDetail && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowDetail((v) => !v)
                  }}
                  className="ml-1 inline-flex align-middle text-destructive/70 hover:text-destructive"
                  aria-label="Show details"
                >
                  <Info className="h-3 w-3" />
                </button>
              )}
            </p>
            {showDetail && card.errorDetail && (
              <p className="text-[10px] text-destructive/80 text-center leading-tight">
                {card.errorDetail}
              </p>
            )}
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
        )}

        {/* Saved / ready badge */}
        {card.status === "ready" && (
          <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 bg-background/90 rounded px-1.5 py-0.5 text-[10px] font-medium text-foreground">
            <Check className="h-3 w-3" />
            Ready
          </div>
        )}

        {/* Remove button */}
        <button
          type="button"
          onClick={() => onRemove(card.id)}
          className="absolute top-1.5 right-1.5 h-6 w-6 flex items-center justify-center bg-background/80 hover:bg-background border border-border text-foreground/60 hover:text-foreground transition-colors"
          aria-label="Remove image"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Editable fields */}
      <div className="p-2 space-y-1.5">
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={card.title}
            onChange={(e) => onUpdate(card.id, { title: e.target.value })}
            className="min-w-0 flex-1 text-xs font-medium bg-transparent border-0 border-b border-transparent focus:border-border focus:outline-none px-0 py-0.5 truncate"
            placeholder="Title"
          />
        </div>
        {flagTitle && (
          <span className="inline-block text-[10px] font-medium text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950 rounded px-1.5 py-0.5">
            Needs a title
          </span>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="w-full h-7 text-xs text-muted-foreground"
          onClick={() => onDetails(card.id)}
          disabled={busy}
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
  const photoInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const [fieldOptions, setFieldOptions] = useState<Record<FieldOptionField, string[]>>({
    medium: [],
    dimensions: [],
  })
  const [allTags, setAllTags] = useState<string[]>([])

  const [defaults, setDefaults] = useState<BulkDefaults>(() => loadDefaults(defaultSectionId))
  const [defaultsDirty, setDefaultsDirty] = useState(false)

  // Reload-recovery banner — localStorage isn't available during SSR, so this
  // is read after mount (deferred a microtask so the setState below doesn't
  // run synchronously inside the effect body).
  const [draftCards, setDraftCards] = useState<DraftCard[] | null>(null)
  useEffect(() => {
    Promise.resolve().then(() => {
      const d = readDraft()
      if (d.length > 0) setDraftCards(d)
    })
  }, [])

  useEffect(() => {
    getFieldOptions().then((result) => {
      if (!result.ok) return
      setFieldOptions({
        medium: result.options.medium.map((o) => o.value),
        dimensions: result.options.dimensions.map((o) => o.value),
      })
    })
    getAllTags().then((result) => {
      if (!result.ok) return
      setAllTags(result.tags.map((t) => t.name))
    })
  }, [])

  // Persist defaults on every change
  useEffect(() => {
    try {
      window.localStorage.setItem(DEFAULTS_STORAGE_KEY, JSON.stringify(defaults))
    } catch {
      // best-effort
    }
  }, [defaults])

  // Persist ready cards (the draft) on every change
  useEffect(() => {
    writeDraft(cards)
  }, [cards])

  function updateDefaults(updates: Partial<BulkDefaults>) {
    setDefaults((prev) => ({ ...prev, ...updates }))
    setDefaultsDirty(true)
  }

  function applyDefaultsToAllCards() {
    setCards((prev) => prev.map((c) => ({ ...c, ...defaults })))
    setDefaultsDirty(false)
    toast.success("Applied to every photo", { duration: 5000 })
  }

  function applyToAllCards(field: FieldOptionField, value: string) {
    setCards((prev) => prev.map((c) => ({ ...c, [field]: value })))
  }

  // ─── Upload queue ──────────────────────────────────────────────────────────

  const uploadQueueRef = useRef<Array<{ cardId: string; file: File }>>([])
  const activeCountRef = useRef(0)
  const drainQueueRef = useRef<() => void>(() => {})

  const uploadOneFile = useCallback(async (cardId: string, file: File) => {
    setCards((prev) =>
      prev.map((c) =>
        c.id === cardId ? { ...c, status: "uploading" as const, progress: 0 } : c
      )
    )
    try {
      const result = await uploadImage("paintings", file, {
        onProgress: (pct) => {
          setCards((prev) =>
            prev.map((c) => (c.id === cardId ? { ...c, progress: pct } : c))
          )
        },
      })
      setCards((prev) =>
        prev.map((c) =>
          c.id === cardId
            ? {
                ...c,
                status: "ready" as const,
                progress: 100,
                uploadUrl: result.url,
                uploadPath: result.path,
                width: result.width,
                height: result.height,
              }
            : c
        )
      )
    } catch (e) {
      const { headline, detail } = explainUploadError(e)
      setCards((prev) =>
        prev.map((c) =>
          c.id === cardId
            ? { ...c, status: "error" as const, error: headline, errorDetail: detail }
            : c
        )
      )
    } finally {
      activeCountRef.current--
      drainQueueRef.current()
    }
  }, [])

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

  useEffect(() => {
    drainQueueRef.current = drainQueue
  }, [drainQueue])

  const enqueueFiles = useCallback(
    (files: File[]) => {
      const heicFiles = files.filter(isHeicFile)
      const images = files.filter((f) => !isHeicFile(f) && ACCEPTED_TYPES.includes(f.type))

      if (heicFiles.length > 0) {
        toast.error(
          `${heicFiles.length} photo${heicFiles.length !== 1 ? "s" : ""} skipped — HEIC isn't supported`,
          {
            description: "iPhone: Settings → Camera → Formats → Most Compatible, then try again.",
            duration: 8000,
          }
        )
      }

      if (images.length === 0) return
      const newCards = images.map((f) => makeCard(f, defaults))
      setCards((prev) => [...prev, ...newCards])
      uploadQueueRef.current.push(
        ...newCards.map((c) => ({ cardId: c.id, file: c.file! }))
      )
      drainQueue()
    },
    [defaults, drainQueue]
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
    e.target.value = ""
  }

  function handlePhotoInput(e: React.ChangeEvent<HTMLInputElement>) {
    enqueueFiles(Array.from(e.target.files ?? []))
    e.target.value = ""
  }

  function updateCard(id: string, updates: Partial<BulkCard>) {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)))
  }

  async function deleteUploaded(path: string) {
    await fetch("/api/admin/delete-upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, bucket: "paintings" }),
    }).catch(() => {})
  }

  async function removeCard(cardId: string) {
    const card = cards.find((c) => c.id === cardId)
    if (!card) return

    if (card.previewUrl.startsWith("blob:")) URL.revokeObjectURL(card.previewUrl)
    if (card.uploadPath) await deleteUploaded(card.uploadPath)

    setCards((prev) => prev.filter((c) => c.id !== cardId))
    if (detailsCardId === cardId) setDetailsCardId(null)
  }

  function retryCard(cardId: string) {
    const card = cards.find((c) => c.id === cardId)
    if (!card || card.status !== "error" || !card.file) return
    updateCard(cardId, { status: "queued", error: null, errorDetail: null, progress: 0 })
    uploadQueueRef.current.push({ cardId, file: card.file })
    drainQueue()
  }

  function retryAllFailed() {
    const failedCards = cards.filter((c) => c.status === "error" && c.file)
    if (failedCards.length === 0) return
    setCards((prev) =>
      prev.map((c) =>
        c.status === "error" && c.file
          ? { ...c, status: "queued" as const, error: null, errorDetail: null, progress: 0 }
          : c
      )
    )
    uploadQueueRef.current.push(
      ...failedCards.map((c) => ({ cardId: c.id, file: c.file! }))
    )
    drainQueue()
  }

  // ─── Wake lock — keep the phone screen on while uploads are in flight ──────

  const uploadingCount = cards.filter(
    (c) => c.status === "uploading" || c.status === "queued"
  ).length

  const wakeLockRef = useRef<WakeLockSentinel | null>(null)
  useEffect(() => {
    let cancelled = false
    async function sync() {
      if (uploadingCount > 0) {
        if (!wakeLockRef.current && "wakeLock" in navigator) {
          try {
            const lock = await navigator.wakeLock.request("screen")
            if (cancelled) {
              lock.release().catch(() => {})
            } else {
              wakeLockRef.current = lock
            }
          } catch {
            // Wake lock isn't available/permitted — non-fatal.
          }
        }
      } else if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {})
        wakeLockRef.current = null
      }
    }
    void sync()
    return () => {
      cancelled = true
    }
  }, [uploadingCount])

  // Re-drain the queue when the tab becomes visible again — a stalled upload
  // from a locked screen will have already errored and is safe to re-kick.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") drainQueueRef.current()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => document.removeEventListener("visibilitychange", onVisible)
  }, [])

  // Warn before leaving with uploads in flight or unsaved ready cards.
  const readyCount = cards.filter((c) => c.status === "ready").length
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (uploadingCount > 0 || readyCount > 0) {
        e.preventDefault()
        e.returnValue = ""
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [uploadingCount, readyCount])

  // ─── Save / cancel ──────────────────────────────────────────────────────────

  async function handleSaveAll() {
    const readyCards = cards.filter((c) => c.status === "ready")
    if (readyCards.length === 0) return

    setSaving(true)
    toast.loading(
      `Saving ${readyCards.length} painting${readyCards.length !== 1 ? "s" : ""}…`,
      { id: "bulk-save" }
    )

    const items: BulkCreateItem[] = readyCards.map((c) => ({
      title: needsTitleAttention(c.title) ? "Untitled" : c.title,
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

    const failed = result.failed ?? []
    const failedTitles = new Set(failed.map((f) => f.title))

    const savedCards = readyCards.filter((c) => !failedTitles.has(c.title))

    const seenPairs = new Set<string>()
    for (const c of savedCards) {
      const key = `${c.medium}|||${c.dimensions}`
      if (seenPairs.has(key)) continue
      seenPairs.add(key)
      if (c.medium || c.dimensions) {
        void touchFieldOptions({ medium: c.medium || undefined, dimensions: c.dimensions || undefined })
      }
    }

    if (failed.length > 0) {
      const names = failed.slice(0, 5).map((f) => f.title).join(", ")
      const suffix = failed.length > 5 ? `, and ${failed.length - 5} more` : ""
      toast.error(
        `${failed.length} photo${failed.length !== 1 ? "s" : ""} couldn't be saved: ${names}${suffix}`,
        { id: "bulk-save", duration: 8000 }
      )
    } else {
      toast.success(
        `${result.count} painting${result.count !== 1 ? "s" : ""} added.`,
        { id: "bulk-save" }
      )
    }

    savedCards.forEach((c) => {
      if (c.previewUrl.startsWith("blob:")) URL.revokeObjectURL(c.previewUrl)
    })

    if (failed.length > 0) {
      setCards((prev) => prev.filter((c) => failedTitles.has(c.title)))
      setSaving(false)
      return
    }

    const target = result.sectionSlug
      ? `/admin/portfolio/${result.sectionSlug}`
      : "/admin/portfolio"
    router.push(target)
  }

  async function handleCancel() {
    const toDelete = cards.filter((c) => c.uploadPath)
    await Promise.allSettled(toDelete.map((c) => deleteUploaded(c.uploadPath!)))
    cards.forEach((c) => {
      if (c.previewUrl.startsWith("blob:")) URL.revokeObjectURL(c.previewUrl)
    })
    setCards([])
    setDetailsCardId(null)
  }

  // Revoke preview URLs on unmount
  useEffect(() => {
    return () => {
      cards.forEach((c) => {
        if (c.previewUrl.startsWith("blob:")) URL.revokeObjectURL(c.previewUrl)
      })
    }
    // intentionally only on unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Draft restore banner ──────────────────────────────────────────────────

  function continueDraft() {
    if (!draftCards) return
    setCards((prev) => [...prev, ...draftCards.map(draftCardToBulkCard)])
    setDraftCards(null)
  }

  async function discardDraft() {
    if (!draftCards) return
    await Promise.allSettled(draftCards.map((d) => deleteUploaded(d.uploadPath)))
    try {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY)
    } catch {
      // best-effort
    }
    setDraftCards(null)
  }

  const errorCount = cards.filter((c) => c.status === "error").length
  const hasCards = cards.length > 0
  const detailsCard = cards.find((c) => c.id === detailsCardId) ?? null

  const overallProgress = useMemo(() => {
    if (cards.length === 0) return 0
    const total = cards.reduce((sum, c) => {
      if (c.status === "ready") return sum + 100
      if (c.status === "uploading") return sum + c.progress
      return sum
    }, 0)
    return Math.round(total / cards.length)
  }, [cards])

  return (
    <div className={cn("space-y-6", hasCards && "pb-32")}>
      {/* Reload-recovery banner */}
      {draftCards && draftCards.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 border border-amber-300 bg-amber-50 dark:bg-amber-950 dark:border-amber-800 rounded-lg px-4 py-3 text-sm">
          <span className="flex-1 min-w-0">
            You have {draftCards.length} uploaded photo{draftCards.length !== 1 ? "s" : ""} that{" "}
            {draftCards.length !== 1 ? "weren't" : "wasn't"} saved.
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={discardDraft}>
              Discard
            </Button>
            <Button size="sm" onClick={continueDraft}>
              Continue
            </Button>
          </div>
        </div>
      )}

      {/* Defaults card — applies to every new photo added */}
      <div className="border border-border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium">Applies to every photo you add</h2>
          {defaultsDirty && hasCards && (
            <button
              type="button"
              onClick={applyDefaultsToAllCards}
              className="text-xs text-primary hover:underline underline-offset-2 shrink-0"
            >
              Apply to all {cards.length} photo{cards.length !== 1 ? "s" : ""} already added
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <FormField label="Gallery">
            <select
              value={defaults.sectionId}
              onChange={(e) => updateDefaults({ sectionId: e.target.value })}
              className="w-full h-8 rounded-lg border border-input bg-background px-2.5 text-base md:text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Medium">
            <OptionSelect
              value={defaults.medium}
              onChange={(v) => updateDefaults({ medium: v })}
              options={fieldOptions.medium}
              placeholder="Oil on canvas"
            />
          </FormField>
          <FormField label="Size">
            <OptionSelect
              value={defaults.dimensions}
              onChange={(v) => updateDefaults({ dimensions: v })}
              options={fieldOptions.dimensions}
              placeholder='24"x36"'
            />
          </FormField>
          <FormField label="Year">
            <Input
              type="number"
              min={1800}
              max={2100}
              value={defaults.year}
              onChange={(e) => updateDefaults({ year: e.target.value })}
              placeholder="2024"
            />
          </FormField>
          <FormField label="Status">
            <select
              value={defaults.paintingStatus}
              onChange={(e) =>
                updateDefaults({ paintingStatus: e.target.value as PaintingStatus })
              }
              className="w-full h-8 rounded-lg border border-input bg-background px-2.5 text-base md:text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="available">Available</option>
              <option value="sold">Sold</option>
              <option value="nfs">Not for sale</option>
              <option value="reserved">Reserved</option>
            </select>
          </FormField>
          <FormField label="Price (USD)">
            <Input
              type="number"
              min={0}
              step={0.01}
              value={defaults.price}
              onChange={(e) => updateDefaults({ price: e.target.value })}
              placeholder="1500.00"
            />
          </FormField>
          <FormField label="Tags" className="col-span-2 sm:col-span-3 lg:col-span-6">
            <TagPicker
              value={defaults.tags}
              onChange={(tags) => updateDefaults({ tags })}
              allTags={allTags}
            />
          </FormField>
        </div>
      </div>

      {/* Add buttons — full width, phone-first */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          className="h-12 text-base"
          onClick={() => photoInputRef.current?.click()}
        >
          <Upload className="h-4 w-4 mr-2" />
          Choose photos
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-12 text-base"
          onClick={() => cameraInputRef.current?.click()}
        >
          <Camera className="h-4 w-4 mr-2" />
          Take a photo
        </Button>
      </div>

      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={handlePhotoInput}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        capture="environment"
        className="sr-only"
        onChange={handlePhotoInput}
      />

      {/* Desktop drop zone */}
      <div
        {...getRootProps()}
        className={cn(
          "hidden sm:block border-2 border-dashed transition-colors cursor-pointer",
          hasCards ? "rounded-lg p-4 text-center" : "rounded-xl p-8 text-center",
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/40 hover:bg-muted/40"
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-row items-center justify-center gap-3 text-muted-foreground text-sm">
          <Upload className="h-4 w-4 shrink-0" />
          <span>Or drop images here, or drag a whole folder</span>
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

      {/* Overall progress */}
      {uploadingCount > 0 && (
        <div className="space-y-1.5">
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Uploading {cards.length - readyCount - errorCount} of {cards.length}
            {errorCount > 0 && ` · ${errorCount} failed`}
          </p>
        </div>
      )}
      {uploadingCount === 0 && errorCount > 0 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-destructive">
            {errorCount} photo{errorCount !== 1 ? "s" : ""} failed to upload
          </p>
          <Button size="sm" variant="outline" onClick={retryAllFailed}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Retry failed
          </Button>
        </div>
      )}

      {/* Card grid */}
      {hasCards && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {cards.map((card) => (
            <BulkCardItem
              key={card.id}
              card={card}
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
              fieldOptions={fieldOptions}
              allTags={allTags}
              onApplyToAll={applyToAllCards}
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
        <div
          className="fixed bottom-0 inset-x-0 z-50 border-t border-border bg-card shadow-lg px-4 py-3"
          style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
        >
          <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
              <span className="font-medium text-sm">
                {readyCount} painting{readyCount !== 1 ? "s" : ""} ready to save
              </span>
              <span className="text-xs text-muted-foreground">
                Failed photos stay here so you can retry
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <ConfirmDialog
                trigger={
                  <Button variant="outline" size="sm" disabled={saving}>
                    Start over
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
