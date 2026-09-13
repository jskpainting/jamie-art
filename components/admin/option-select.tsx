"use client"

import { useEffect, useRef, useState } from "react"
import { Input } from "@/components/ui/input"

interface OptionSelectProps {
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder?: string
  otherLabel?: string
}

const SELECT_CLASSNAME =
  "w-full h-8 rounded-lg border border-input bg-background px-2.5 text-base md:text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"

/**
 * Native <select> (styled like the Status select) listing recent-first
 * options plus "Other…". Choosing Other swaps to a free-text Input. If the
 * current value isn't in the list (old data, custom value) it starts in
 * Other mode showing that value.
 */
export function OptionSelect({
  value,
  onChange,
  options,
  placeholder,
  otherLabel = "Other…",
}: OptionSelectProps) {
  const [otherMode, setOtherMode] = useState(
    () => value.trim() !== "" && !options.includes(value)
  )
  const inputRef = useRef<HTMLInputElement>(null)

  // If options finish loading after mount and the value is now recognised,
  // don't force Other mode just because it started that way.
  useEffect(() => {
    if (value.trim() !== "" && options.includes(value) && otherMode === false) return
  }, [options, value, otherMode])

  useEffect(() => {
    if (otherMode) inputRef.current?.focus()
  }, [otherMode])

  function handleSelectChange(next: string) {
    if (next === "__other__") {
      setOtherMode(true)
      return
    }
    onChange(next)
  }

  if (otherMode) {
    return (
      <div className="space-y-1">
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={() => setOtherMode(false)}
          className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
        >
          Back to list
        </button>
      </div>
    )
  }

  return (
    <select
      value={options.includes(value) ? value : ""}
      onChange={(e) => handleSelectChange(e.target.value)}
      className={SELECT_CLASSNAME}
    >
      <option value="">—</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
      <option value="__other__">{otherLabel}</option>
    </select>
  )
}
