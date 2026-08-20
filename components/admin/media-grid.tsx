"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { format } from "date-fns"
import { ImageOff } from "lucide-react"
import { listMedia, type MediaBucket, type MediaItem } from "@/lib/actions/media"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/admin/empty-state"
import { ListToolbar, FilteredEmptyState } from "@/components/admin/list-toolbar"
import { cn } from "@/lib/utils"

type SortKey = "newest" | "oldest" | "largest" | "smallest"

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "largest", label: "Largest" },
  { value: "smallest", label: "Smallest" },
]

function filenameOf(item: MediaItem): string {
  return item.path.split("/").pop() ?? item.path
}

export type BucketFilter = MediaBucket | "all"

const BUCKET_TABS: { value: BucketFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "paintings", label: "Paintings" },
  { value: "events", label: "Events" },
  { value: "site-images", label: "Site photos" },
  { value: "headshots", label: "Headshots" },
]

export function formatBytes(bytes: number): string {
  if (!bytes) return "0 KB"
  const kb = bytes / 1024
  if (kb < 1024) return `${Math.round(kb)} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

interface MediaGridProps {
  onSelect: (item: MediaItem) => void
  /** Which bucket tab to start on — e.g. the field's own bucket when opened as a picker. */
  initialBucket?: BucketFilter
  /** Bump this to force a refetch (e.g. after an upload or delete). */
  refreshKey?: number
  className?: string
  /** Show the search + sort toolbar. Off by default in the compact picker dialog. */
  showToolbar?: boolean
}

export function MediaGrid({
  onSelect,
  initialBucket = "all",
  refreshKey = 0,
  className,
  showToolbar = false,
}: MediaGridProps) {
  const [bucket, setBucket] = useState<BucketFilter>(initialBucket)
  const [showCropped, setShowCropped] = useState(false)
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState<SortKey>("newest")

  // Fetch is keyed so `loading` can be derived from whether the latest
  // result matches the current request — no setState() at the top of the
  // effect body (avoids the cascading-render lint rule).
  const requestKey = `${bucket}:${refreshKey}`
  const [result, setResult] = useState<{
    key: string
    items: MediaItem[]
    error: string | null
  } | null>(null)

  useEffect(() => {
    let cancelled = false
    listMedia(bucket === "all" ? undefined : bucket).then((res) => {
      if (cancelled) return
      setResult(
        res.ok
          ? { key: requestKey, items: res.data, error: null }
          : { key: requestKey, items: [], error: res.error }
      )
    })
    return () => {
      cancelled = true
    }
  }, [bucket, refreshKey, requestKey])

  const loading = result?.key !== requestKey
  const items = result && result.key === requestKey ? result.items : []
  const error = result && result.key === requestKey ? result.error : null

  const croppedFiltered = showCropped ? items : items.filter((i) => !i.isCrop)

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    let result = q
      ? croppedFiltered.filter((i) => filenameOf(i).toLowerCase().includes(q))
      : croppedFiltered
    result = [...result].sort((a, b) => {
      switch (sort) {
        case "oldest":
          return (a.createdAt ? new Date(a.createdAt).getTime() : 0) -
            (b.createdAt ? new Date(b.createdAt).getTime() : 0)
        case "largest":
          return b.size - a.size
        case "smallest":
          return a.size - b.size
        case "newest":
        default:
          return (b.createdAt ? new Date(b.createdAt).getTime() : 0) -
            (a.createdAt ? new Date(a.createdAt).getTime() : 0)
      }
    })
    return result
  }, [croppedFiltered, search, sort])

  const hasActiveFilters = search.trim().length > 0

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={bucket}
          onValueChange={(v) => setBucket(v as BucketFilter)}
        >
          <TabsList>
            {BUCKET_TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <label className="flex items-center gap-2 text-xs text-muted-foreground select-none cursor-pointer">
          <input
            type="checkbox"
            checked={showCropped}
            onChange={(e) => setShowCropped(e.target.checked)}
            className="accent-foreground"
          />
          Show cropped copies
        </label>
      </div>

      {showToolbar && (
        <ListToolbar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search filename…"
          searchLabel="Search images"
          sortValue={sort}
          onSortChange={(v) => setSort(v as SortKey)}
          sortOptions={SORT_OPTIONS}
          sortLabel="Sort images"
          resultCount={visible.length}
          totalCount={croppedFiltered.length}
          itemNoun="images"
          hasActiveFilters={hasActiveFilters}
          onClear={() => setSearch("")}
        />
      )}

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-none" />
          ))}
        </div>
      ) : error ? (
        <EmptyState icon={ImageOff} message={error} />
      ) : visible.length === 0 && croppedFiltered.length > 0 && showToolbar ? (
        <FilteredEmptyState query={search} itemNoun="images" onClear={() => setSearch("")} />
      ) : visible.length === 0 ? (
        <EmptyState icon={ImageOff} message="No images here yet." />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {visible.map((item) => (
            <button
              key={`${item.bucket}/${item.path}`}
              type="button"
              onClick={() => onSelect(item)}
              className="group flex flex-col gap-1 text-left"
            >
              <div className="relative aspect-square w-full overflow-hidden border border-border bg-muted">
                <Image
                  src={item.url}
                  alt=""
                  fill
                  sizes="200px"
                  className="object-cover transition-opacity group-hover:opacity-80"
                />
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {item.createdAt ? format(new Date(item.createdAt), "MMM d, yyyy") : "—"}
                {" · "}
                {formatBytes(item.size)}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
