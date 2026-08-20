"use client"

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { Minus, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ListToolbar, FilteredEmptyState } from "@/components/admin/list-toolbar"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { ShowCard, CARD_WIDTH_MM, CARD_HEIGHT_MM } from "@/components/print/show-card"
import type { PaintingForCards } from "@/lib/db/queries"

// CSS mm -> px is a fixed ratio (96px per inch), independent of device DPI.
const MM_TO_PX = 96 / 25.4
const CARD_WIDTH_PX = CARD_WIDTH_MM * MM_TO_PX
const CARD_HEIGHT_PX = CARD_HEIGHT_MM * MM_TO_PX

/**
 * Renders the show-card proof at true physical size whenever there's room,
 * and scales it down proportionally (via CSS transform, never distorting the
 * aspect ratio) when the surrounding column is narrower than the card — e.g.
 * a 375px phone screen, where the flex column would otherwise stretch the
 * wrapper to ~293px and clip the fixed-336px card. The outer div is left to
 * take whatever width the flex layout gives it (matching prior behavior on
 * desktop, where it just shrinks to the card's natural size); a
 * ResizeObserver measures that width and derives the scale factor, so the
 * whole card is always fully visible and the caption stays honest about
 * whether it's true size.
 */
function ScaledCardProof({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () => {
      const available = el.offsetWidth
      if (available <= 0) return
      setScale(Math.min(1, available / CARD_WIDTH_PX))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const scaledWidth = Math.round(CARD_WIDTH_PX * scale)
  const scaledHeight = Math.round(CARD_HEIGHT_PX * scale)
  const isScaledDown = scale < 0.999

  return (
    <div ref={containerRef}>
      <div
        className="overflow-hidden shadow-sm ring-1 ring-border"
        style={{ width: scaledWidth, height: scaledHeight }}
      >
        <div
          style={{
            width: CARD_WIDTH_PX,
            height: CARD_HEIGHT_PX,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          {children}
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {isScaledDown
          ? "Shown smaller to fit your screen — prints at 3.5 × 2 in."
          : "Actual printed size (roughly)"}
      </p>
    </div>
  )
}

const STORAGE_KEY = "show-cards:v1"
export const DEFAULT_TAGLINE = "Scan to see it on your wall"
type Paper = "letter" | "a4"

interface StoredState {
  selections: Record<string, number>
  tagline: string
  showThumb: boolean
  paper: Paper
}

type CardsFilter = "all" | "selected" | "unselected" | "with-ar" | "without-ar"
type CardsSort = "gallery" | "title"

const CARDS_FILTER_OPTIONS = [
  { value: "all", label: "All paintings" },
  { value: "selected", label: "Chosen for printing" },
  { value: "unselected", label: "Not chosen yet" },
  { value: "with-ar", label: "Works on a wall (has 3D model)" },
  { value: "without-ar", label: "No 3D model yet" },
]

const CARDS_SORT_OPTIONS = [
  { value: "gallery", label: "Grouped by gallery" },
  { value: "title", label: "Title A–Z" },
]

interface ShowCardsClientProps {
  paintings: PaintingForCards[]
  arModelIds: string[]
  qrByPaintingId: Record<string, string>
}

function SimpleSwitch({
  checked,
  onCheckedChange,
  id,
}: {
  checked: boolean
  onCheckedChange: (v: boolean) => void
  id?: string
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        checked ? "bg-primary" : "bg-muted"
      )}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 transform rounded-full bg-background shadow transition-transform",
          checked ? "translate-x-4" : "translate-x-0.5"
        )}
      />
    </button>
  )
}

export function ShowCardsClient({
  paintings,
  arModelIds,
  qrByPaintingId,
}: ShowCardsClientProps) {
  const arModelSet = useMemo(() => new Set(arModelIds), [arModelIds])

  // Restored via a lazy useState initializer (not an effect) so there's no
  // extra setState-after-mount render pass: on the client this reads
  // localStorage synchronously during the first render; on the server (no
  // window) it falls back to defaults, same as an empty store.
  const [stored] = useState<StoredState>(() => {
    const defaults: StoredState = {
      selections: {},
      tagline: DEFAULT_TAGLINE,
      showThumb: true,
      paper: "letter",
    }
    if (typeof window === "undefined") return defaults
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (!raw) return defaults
      const parsed = JSON.parse(raw) as Partial<StoredState>
      return {
        selections:
          parsed.selections && typeof parsed.selections === "object"
            ? parsed.selections
            : defaults.selections,
        tagline: typeof parsed.tagline === "string" ? parsed.tagline : defaults.tagline,
        showThumb:
          typeof parsed.showThumb === "boolean" ? parsed.showThumb : defaults.showThumb,
        paper: parsed.paper === "letter" || parsed.paper === "a4" ? parsed.paper : defaults.paper,
      }
    } catch {
      return defaults
    }
  })

  const [selections, setSelections] = useState<Record<string, number>>(stored.selections)
  const [tagline, setTagline] = useState(stored.tagline)
  const [showThumb, setShowThumb] = useState(stored.showThumb)
  const [paper, setPaper] = useState<Paper>(stored.paper)

  // Persist on every change. Writing to localStorage (not calling setState)
  // is exactly what effects are for — this is not the restore step above.
  useEffect(() => {
    try {
      const data: StoredState = { selections, tagline, showThumb, paper }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch {
      // quota / privacy-mode errors — ignore
    }
  }, [selections, tagline, showThumb, paper])

  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<CardsFilter>("all")
  const [sort, setSort] = useState<CardsSort>("gallery")

  const hasActiveFilters =
    search.trim() !== "" || filter !== "all" || sort !== "gallery"

  const resetView = useCallback(() => {
    setSearch("")
    setFilter("all")
    setSort("gallery")
  }, [])

  const visiblePaintings = useMemo(() => {
    const q = search.trim().toLowerCase()
    let rows = paintings.filter((p) => {
      if (filter === "selected" && !selections[p.id]) return false
      if (filter === "unselected" && selections[p.id]) return false
      if (filter === "with-ar" && !arModelSet.has(p.id)) return false
      if (filter === "without-ar" && arModelSet.has(p.id)) return false
      if (!q) return true
      return (
        p.title.toLowerCase().includes(q) ||
        (p.section_title ?? "").toLowerCase().includes(q)
      )
    })
    if (sort === "title") {
      rows = [...rows].sort((a, b) => a.title.localeCompare(b.title))
    }
    return rows
  }, [paintings, search, filter, sort, selections, arModelSet])

  const groups = useMemo(() => {
    const map = new Map<string, { title: string; paintings: PaintingForCards[] }>()
    for (const p of visiblePaintings) {
      const key = p.section_slug || "uncategorized"
      if (!map.has(key)) {
        map.set(key, { title: p.section_title || "Uncategorized", paintings: [] })
      }
      map.get(key)!.paintings.push(p)
    }
    return [...map.values()]
  }, [visiblePaintings])

  function toggle(id: string) {
    setSelections((prev) => {
      if (prev[id]) {
        const next = { ...prev }
        delete next[id]
        return next
      }
      return { ...prev, [id]: 1 }
    })
  }

  function setCopies(id: string, copies: number) {
    const clamped = Math.min(99, Math.max(1, copies))
    setSelections((prev) => ({ ...prev, [id]: clamped }))
  }

  function selectAllInGallery(ids: string[]) {
    setSelections((prev) => {
      const next = { ...prev }
      for (const id of ids) {
        if (!next[id]) next[id] = 1
      }
      return next
    })
  }

  const selectedIds = Object.keys(selections)
  const paintingCount = selectedIds.length
  // Selection deliberately survives a filter change (it is also restored from
  // localStorage), so any selected painting the filter is hiding must be
  // disclosed — otherwise the sheet count won't match what's on screen.
  const visibleIdSet = useMemo(
    () => new Set(visiblePaintings.map((p) => p.id)),
    [visiblePaintings]
  )
  const hiddenSelectedCount = selectedIds.filter((id) => !visibleIdSet.has(id)).length
  const cardCount = Object.values(selections).reduce((sum, n) => sum + n, 0)
  const sheetCount = cardCount > 0 ? Math.ceil(cardCount / 10) : 0

  const proofPainting: PaintingForCards | undefined =
    paintings.find((p) => selections[p.id]) ?? paintings[0]
  const proofQr = proofPainting ? qrByPaintingId[proofPainting.id] ?? "" : ""

  function handlePrint() {
    const params = new URLSearchParams()
    params.set("paper", paper)
    params.set("thumb", showThumb ? "1" : "0")
    params.set("tagline", tagline.trim() || DEFAULT_TAGLINE)
    params.set(
      "c",
      selectedIds.map((id) => `${id}:${selections[id]}`).join(",")
    )
    window.open(`/admin/print/show-cards?${params.toString()}`, "_blank")
  }

  return (
    <div className="pb-24">
      {/* Proof + options */}
      <div className="mb-8 flex flex-col gap-6 rounded-xl border border-border bg-card p-4 md:flex-row md:items-start md:p-6">
        <div className="shrink-0">
          <ScaledCardProof>
            {proofPainting ? (
              <ShowCard
                painting={proofPainting}
                qrSvg={proofQr}
                showThumb={showThumb}
                tagline={tagline.trim() || DEFAULT_TAGLINE}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-muted text-xs text-muted-foreground">
                No paintings yet
              </div>
            )}
          </ScaledCardProof>
        </div>

        <div className="flex-1 space-y-5">
          <div>
            <label
              htmlFor="tagline-input"
              className="mb-1.5 block text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground"
            >
              Tagline
            </label>
            <Input
              id="tagline-input"
              value={tagline}
              maxLength={40}
              onChange={(e) => setTagline(e.target.value)}
              placeholder={DEFAULT_TAGLINE}
              className="max-w-sm"
            />
          </div>

          <div className="flex items-center gap-3">
            <SimpleSwitch id="show-thumb" checked={showThumb} onCheckedChange={setShowThumb} />
            <label htmlFor="show-thumb" className="text-sm">
              Show a small picture of the painting
            </label>
          </div>

          <div>
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
              Paper
            </span>
            <div className="inline-flex rounded-md border border-border p-0.5">
              {(["letter", "a4"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPaper(p)}
                  className={cn(
                    "rounded-[6px] px-3 py-1 text-sm transition-colors",
                    paper === p
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {p === "letter" ? "Letter" : "A4"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mb-4 space-y-3">
        <ListToolbar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by title or gallery…"
          searchLabel="Search paintings"
          filterValue={filter}
          onFilterChange={(v) => setFilter(v as CardsFilter)}
          filterOptions={CARDS_FILTER_OPTIONS}
          filterLabel="Show only"
          sortValue={sort}
          onSortChange={(v) => setSort(v as CardsSort)}
          sortOptions={CARDS_SORT_OPTIONS}
          sortLabel="Order this list by"
          resultCount={visiblePaintings.length}
          totalCount={paintings.length}
          itemNoun="paintings"
          hasActiveFilters={hasActiveFilters}
          onClear={resetView}
        />

        {hiddenSelectedCount > 0 && (
          <p className="text-xs text-muted-foreground">
            {paintingCount} chosen for printing ({hiddenSelectedCount} hidden
            right now —{" "}
            <button
              type="button"
              onClick={resetView}
              className="underline underline-offset-2 hover:text-foreground"
            >
              show all
            </button>
            ). They will still be printed.
          </p>
        )}
      </div>

      {/* Selection grid, grouped by gallery */}
      {paintings.length > 0 && visiblePaintings.length === 0 ? (
        <FilteredEmptyState query={search} itemNoun="paintings" onClear={resetView} />
      ) : (
      <div className="space-y-8">
        {groups.map((group) => (
          <div key={group.title}>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
                {group.title}
              </h2>
              <button
                type="button"
                onClick={() => selectAllInGallery(group.paintings.map((p) => p.id))}
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                Select all
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
              {group.paintings.map((p) => {
                const selected = !!selections[p.id]
                const copies = selections[p.id] ?? 1
                const hasAr = arModelSet.has(p.id)
                return (
                  <div
                    key={p.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => toggle(p.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        toggle(p.id)
                      }
                    }}
                    className={cn(
                      "group relative aspect-square cursor-pointer overflow-hidden border-2 outline-none transition-colors",
                      selected
                        ? "border-foreground"
                        : "border-transparent hover:border-border"
                    )}
                  >
                    {p.primary_image_url ? (
                      <Image
                        src={p.primary_image_url}
                        alt={p.title}
                        fill
                        sizes="140px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-muted text-center text-[10px] text-muted-foreground">
                        No image
                      </div>
                    )}

                    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-1.5 pt-4">
                      <p className="truncate text-[11px] font-medium text-white">
                        {p.title}
                      </p>
                    </div>

                    {!hasAr && (
                      <span className="pointer-events-none absolute top-1 left-1 rounded bg-black/55 px-1 py-0.5 text-[9px] leading-tight text-white">
                        no wall view — card links to the page
                      </span>
                    )}

                    {selected && (
                      <div
                        className="absolute top-1 right-1 z-10 flex items-center gap-0.5 rounded-full bg-background/95 px-0.5 py-0.5 shadow ring-1 ring-border"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          aria-label="Fewer copies"
                          onClick={() => setCopies(p.id, copies - 1)}
                          className="relative flex h-5 w-5 items-center justify-center rounded-full text-foreground after:absolute after:-inset-2.5 after:content-[''] hover:bg-muted"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-4 text-center text-[11px] font-medium tabular-nums">
                          {copies}
                        </span>
                        <button
                          type="button"
                          aria-label="More copies"
                          onClick={() => setCopies(p.id, copies + 1)}
                          className="relative flex h-5 w-5 items-center justify-center rounded-full text-foreground after:absolute after:-inset-2.5 after:content-[''] hover:bg-muted"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      )}

      {/* Sticky summary + print action */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-4 py-3 backdrop-blur md:left-60 md:px-8">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            {paintingCount} painting{paintingCount === 1 ? "" : "s"} · {cardCount} card
            {cardCount === 1 ? "" : "s"} · {sheetCount} sheet{sheetCount === 1 ? "" : "s"}
          </p>
          <div className="flex items-center gap-3">
            {paintingCount === 0 && (
              <span className="hidden text-xs text-muted-foreground sm:inline">
                Pick at least one painting
              </span>
            )}
            <Button
              onClick={handlePrint}
              disabled={paintingCount === 0}
              title={paintingCount === 0 ? "Pick at least one painting" : undefined}
            >
              Print cards
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
