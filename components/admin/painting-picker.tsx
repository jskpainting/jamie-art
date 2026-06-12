"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { ChevronDown, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { PaintingForPicker } from "@/lib/db/queries"

interface PaintingPickerProps {
  paintings: PaintingForPicker[]
  selectedId: string | null
  onSelect: (id: string | null) => void
}

export function PaintingPicker({ paintings, selectedId, onSelect }: PaintingPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = paintings.find((p) => p.id === selectedId) ?? null

  const filtered = paintings.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase())
  )

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    document.addEventListener("keydown", handleKey)
    return () => {
      document.removeEventListener("mousedown", handleClick)
      document.removeEventListener("keydown", handleKey)
    }
  }, [open])

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            if (!open) setSearch("")
            setOpen((v) => !v)
          }}
          className={cn(
            "flex flex-1 items-center gap-3 rounded-md border border-input bg-background px-3 py-2 text-sm text-left transition-colors hover:bg-muted/50",
            open && "ring-1 ring-ring"
          )}
        >
          {selected ? (
            <>
              {selected.primary_image_url ? (
                <Image
                  src={selected.primary_image_url}
                  alt={selected.title}
                  width={32}
                  height={32}
                  className="shrink-0 object-cover"
                  style={{ width: 32, height: 32 }}
                />
              ) : (
                <div className="h-8 w-8 shrink-0 bg-muted" />
              )}
              <span className="flex-1 truncate">{selected.title}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {selected.section_title}
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">No painting selected</span>
          )}
          <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
        </button>

        {selected && (
          <button
            type="button"
            onClick={() => onSelect(null)}
            aria-label="Clear selection"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border border-border bg-popover shadow-md">
          <div className="border-b border-border p-2">
            <input
              ref={inputRef}
              type="text"
              placeholder="Search paintings…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-sm bg-transparent px-2 py-1 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                No paintings found
              </p>
            ) : (
              filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onSelect(p.id)
                    setOpen(false)
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
                    p.id === selectedId && "bg-muted/70"
                  )}
                >
                  {p.primary_image_url ? (
                    <Image
                      src={p.primary_image_url}
                      alt={p.title}
                      width={40}
                      height={40}
                      className="shrink-0 object-cover"
                      style={{ width: 40, height: 40 }}
                    />
                  ) : (
                    <div className="h-10 w-10 shrink-0 bg-muted" />
                  )}
                  <span className="flex-1 truncate">{p.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {p.section_title}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
