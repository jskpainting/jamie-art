"use client"

import { useEffect, useRef, useState } from "react"
import { X } from "lucide-react"
import { Input } from "@/components/ui/input"

interface TagPickerProps {
  value: string[]
  onChange: (names: string[]) => void
  allTags: string[]
}

const SELECT_CLASSNAME =
  "w-full h-8 rounded-lg border border-input bg-background px-2.5 text-base md:text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"

function normalise(raw: string) {
  return raw.trim().toLowerCase().replace(/\s+/g, " ")
}

/**
 * Chips + native-select picker for a painting's tags — mirrors the
 * OptionSelect "pick from a list, or Other…" pattern. `allTags` is the full
 * managed list (from Settings → Tags); anything typed via "Other…" is added
 * to the local selection immediately and gets created in the DB on save via
 * updatePaintingTags's upsert.
 */
export function TagPicker({ value, onChange, allTags }: TagPickerProps) {
  const [otherMode, setOtherMode] = useState(false)
  const [otherValue, setOtherValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (otherMode) inputRef.current?.focus()
  }, [otherMode])

  const available = allTags.filter((t) => !value.includes(t))

  function addTag(name: string) {
    const tag = normalise(name)
    if (!tag || tag.length > 50) return
    if (!value.includes(tag)) onChange([...value, tag])
  }

  function removeTag(tag: string) {
    onChange(value.filter((t) => t !== tag))
  }

  function handleSelectChange(next: string) {
    if (next === "__other__") {
      setOtherMode(true)
      return
    }
    if (next) addTag(next)
  }

  function commitOther() {
    if (otherValue.trim()) addTag(otherValue)
    setOtherValue("")
    setOtherMode(false)
  }

  return (
    <div className="space-y-2">
      {value.length > 0 ? (
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
      ) : allTags.length === 0 && !otherMode ? (
        <p className="text-xs text-muted-foreground">
          No tags yet — type one, or add them in Settings → Tags.
        </p>
      ) : null}

      {otherMode ? (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Input
              ref={inputRef}
              value={otherValue}
              onChange={(e) => setOtherValue(e.target.value)}
              placeholder="New tag name"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  commitOther()
                }
              }}
            />
            <button
              type="button"
              onClick={commitOther}
              className="text-xs text-primary hover:underline underline-offset-2 shrink-0"
            >
              Add
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              setOtherValue("")
              setOtherMode(false)
            }}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            Back to list
          </button>
        </div>
      ) : (
        <select
          value=""
          onChange={(e) => handleSelectChange(e.target.value)}
          className={SELECT_CLASSNAME}
        >
          <option value="">Add a tag…</option>
          {available.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
          <option value="__other__">Other…</option>
        </select>
      )}
    </div>
  )
}
