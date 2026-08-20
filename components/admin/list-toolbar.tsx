"use client"

import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface ListToolbarOption {
  value: string
  label: string
}

interface ListToolbarProps {
  searchValue: string
  onSearchChange: (value: string) => void
  searchPlaceholder?: string
  searchLabel?: string

  filterValue?: string
  onFilterChange?: (value: string) => void
  filterOptions?: ListToolbarOption[]
  filterLabel?: string

  sortValue: string
  onSortChange: (value: string) => void
  sortOptions: ListToolbarOption[]
  sortLabel?: string

  resultCount: number
  totalCount: number
  itemNoun: string

  hasActiveFilters: boolean
  onClear: () => void

  className?: string
  /** Extra controls (e.g. bucket tabs) rendered before the search box. */
  children?: React.ReactNode
}

/**
 * Shared filter + sort toolbar for admin list pages. View-only: never
 * mutates data, just narrows/reorders what's already been fetched.
 */
export function ListToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search…",
  searchLabel = "Search",
  filterValue,
  onFilterChange,
  filterOptions,
  filterLabel = "Filter",
  sortValue,
  onSortChange,
  sortOptions,
  sortLabel = "Sort",
  resultCount,
  totalCount,
  itemNoun,
  hasActiveFilters,
  onClear,
  className,
  children,
}: ListToolbarProps) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        {children}

        <div className="relative flex-1 min-w-[160px] sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchLabel}
            className="pl-8 h-10 sm:h-8"
          />
        </div>

        {filterOptions && onFilterChange && (
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="sr-only">{filterLabel}</span>
            <select
              value={filterValue}
              onChange={(e) => onFilterChange(e.target.value)}
              aria-label={filterLabel}
              className="h-10 sm:h-8 min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {filterOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="sr-only">{sortLabel}</span>
          <select
            value={sortValue}
            onChange={(e) => onSortChange(e.target.value)}
            aria-label={sortLabel}
            className="h-10 sm:h-8 min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="h-10 sm:h-8 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Clear
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Showing {resultCount} of {totalCount} {itemNoun}
      </p>
    </div>
  )
}

/** Friendly "nothing matched" state, distinct from a genuinely-empty list. */
export function FilteredEmptyState({
  query,
  itemNoun,
  onClear,
}: {
  query: string
  itemNoun: string
  onClear: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center rounded-xl border border-dashed border-border">
      <p className="text-sm text-muted-foreground max-w-xs">
        {query ? (
          <>
            No {itemNoun} match &ldquo;{query}&rdquo;.
          </>
        ) : (
          <>No {itemNoun} match your filters.</>
        )}
      </p>
      <Button size="sm" variant="outline" onClick={onClear}>
        Clear filters
      </Button>
    </div>
  )
}
