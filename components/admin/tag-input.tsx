"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Tag } from "@/lib/types"

interface TagInputProps {
  value: string[]
  onChange: (tags: string[]) => void
}

export function TagInput({ value, onChange }: TagInputProps) {
  const [query, setQuery] = useState("")
  const [suggestions, setSuggestions] = useState<Tag[]>([])
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchSuggestions = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSuggestions([])
      setOpen(false)
      return
    }
    try {
      const res = await fetch(`/api/tags?q=${encodeURIComponent(q)}&limit=10`)
      const json = await res.json()
      setSuggestions(json.tags ?? [])
      setOpen(true)
      setActiveIndex(-1)
    } catch {
      setSuggestions([])
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchSuggestions(query), 200)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, fetchSuggestions])

  // Close dropdown on outside click
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [])

  function normalise(raw: string) {
    return raw.trim().toLowerCase()
  }

  function addTag(raw: string) {
    const tag = normalise(raw)
    if (!tag || tag.length > 50) return
    if (!value.includes(tag)) {
      onChange([...value, tag])
    }
    setQuery("")
    setSuggestions([])
    setOpen(false)
    inputRef.current?.focus()
  }

  function removeTag(tag: string) {
    onChange(value.filter((t) => t !== tag))
  }

  // Build dropdown items: matching existing tags + optional "Create" option
  const filtered = suggestions.filter((s) => !value.includes(s.name))
  const trimmedQuery = normalise(query)
  const showCreate =
    trimmedQuery.length > 0 &&
    trimmedQuery.length <= 50 &&
    !suggestions.some((s) => s.name === trimmedQuery) &&
    !value.includes(trimmedQuery)

  const items: Array<{ kind: "tag"; tag: Tag } | { kind: "create"; name: string }> = [
    ...filtered.map((t) => ({ kind: "tag" as const, tag: t })),
    ...(showCreate ? [{ kind: "create" as const, name: trimmedQuery }] : []),
  ]

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      if (open && items.length > 0) {
        setActiveIndex((i) => Math.min(i + 1, items.length - 1))
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, -1))
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (open && activeIndex >= 0 && items[activeIndex]) {
        const item = items[activeIndex]
        addTag(item.kind === "tag" ? item.tag.name : item.name)
      } else if (trimmedQuery) {
        addTag(trimmedQuery)
      }
    } else if (e.key === "Escape") {
      setOpen(false)
    } else if (e.key === "Backspace" && !query && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <div className="space-y-2">
      {/* Chips */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-muted text-foreground border border-border"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label={`Remove ${tag}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input + dropdown */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (query.trim()) setOpen(true)
          }}
          placeholder={value.length === 0 ? "Type to search or create a tag…" : "Add another tag…"}
          className="w-full h-8 rounded-lg border border-input bg-background px-2.5 text-base md:text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring placeholder:text-muted-foreground"
        />

        {open && items.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute z-50 top-full mt-1 w-full bg-card border border-border shadow-md max-h-48 overflow-y-auto"
          >
            {items.map((item, idx) => (
              <button
                key={item.kind === "tag" ? item.tag.id : `create-${item.name}`}
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault()
                  addTag(item.kind === "tag" ? item.tag.name : item.name)
                }}
                className={cn(
                  "w-full text-left px-3 py-2 text-sm transition-colors",
                  idx === activeIndex
                    ? "bg-muted text-foreground"
                    : "text-foreground hover:bg-muted"
                )}
              >
                {item.kind === "tag" ? (
                  item.tag.name
                ) : (
                  <span>
                    Create{" "}
                    <span className="font-medium text-foreground">&apos;{item.name}&apos;</span>
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
