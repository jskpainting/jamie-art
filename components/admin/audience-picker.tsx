"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { countAudience } from "@/lib/actions/crm"
import { searchAudienceContacts, type AudienceContactOption } from "@/lib/actions/newsletters"
import type { AudienceInput } from "@/lib/schemas"

export interface AudienceGroupOption {
  id: string
  name: string
  member_count: number
}

export interface AudienceTagOption {
  name: string
  inUse: number
}

interface AudiencePickerProps {
  subscriberCount: number
  groups: AudienceGroupOption[]
  tags: AudienceTagOption[]
  value: AudienceInput
  onChange: (value: AudienceInput) => void
  /** Reports the live resolved count as it changes (null while loading). */
  onCountChange?: (count: number | null) => void
}

type Mode = AudienceInput["type"]

const MODES: { value: Mode; label: string }[] = [
  { value: "all", label: "All subscribers" },
  { value: "groups", label: "Groups" },
  { value: "tags", label: "Tags" },
  { value: "people", label: "Pick people" },
]

function personLabel(p: { first_name: string | null; last_name: string | null; email: string }): string {
  const name = [p.first_name, p.last_name].filter(Boolean).join(" ")
  return name || p.email
}

/** Radio + chips picker for "who gets this newsletter". Debounces a live
 * count via `countAudience`. Callers should hide this entirely (and treat
 * the audience as `{type:"all"}`) when the `crm` schema capability is off. */
export function AudiencePicker({
  subscriberCount,
  groups,
  tags,
  value,
  onChange,
  onCountChange,
}: AudiencePickerProps) {
  const [selectedPeople, setSelectedPeople] = useState<Map<string, AudienceContactOption>>(new Map())
  const [search, setSearch] = useState("")
  const [searchResults, setSearchResults] = useState<AudienceContactOption[]>([])
  const [searching, setSearching] = useState(false)
  const [count, setCount] = useState<number | null>(subscriberCount)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const mode = value.type

  function setMode(next: Mode) {
    if (next === mode) return
    if (next === "all") onChange({ type: "all" })
    else if (next === "groups") onChange({ type: "groups", ids: [] })
    else if (next === "tags") onChange({ type: "tags", names: [] })
    else onChange({ type: "people", ids: [] })
  }

  // Live count, debounced. Keeps showing the last known count while a new
  // one loads (no flicker) rather than setting state synchronously here.
  useEffect(() => {
    const timer = setTimeout(async () => {
      const result = await countAudience(value)
      setCount(result.ok ? result.count : null)
      onCountChange?.(result.ok ? result.count : null)
    }, 350)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(value)])

  // Search-as-you-type for "Pick people".
  useEffect(() => {
    if (mode !== "people") return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      const result = await searchAudienceContacts(search)
      setSearchResults(result.ok ? result.contacts : [])
      setSearching(false)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search, mode])

  function toggleGroup(id: string) {
    if (value.type !== "groups") return
    const ids = value.ids.includes(id) ? value.ids.filter((g) => g !== id) : [...value.ids, id]
    const label = groups.filter((g) => ids.includes(g.id)).map((g) => g.name).join(", ")
    onChange({ type: "groups", ids, label: label || undefined })
  }

  function toggleTag(name: string) {
    if (value.type !== "tags") return
    const names = value.names.includes(name) ? value.names.filter((t) => t !== name) : [...value.names, name]
    onChange({ type: "tags", names, label: names.length ? names.join(", ") : undefined })
  }

  function togglePerson(p: AudienceContactOption) {
    if (value.type !== "people") return
    const isSelected = value.ids.includes(p.id)
    const nextMap = new Map(selectedPeople)
    let ids: string[]
    if (isSelected) {
      ids = value.ids.filter((id) => id !== p.id)
      nextMap.delete(p.id)
    } else {
      ids = [...value.ids, p.id]
      nextMap.set(p.id, p)
    }
    setSelectedPeople(nextMap)
    const label = ids.length === 1 ? personLabel(p) : `${ids.length} people picked`
    onChange({ type: "people", ids, label: ids.length ? label : undefined })
  }

  const selectedPeopleList = useMemo(() => [...selectedPeople.values()], [selectedPeople])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => setMode(m.value)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              mode === m.value
                ? "border-foreground bg-foreground text-background"
                : "border-input text-muted-foreground hover:text-foreground"
            )}
          >
            {m.label}
            {m.value === "all" && ` (${subscriberCount})`}
          </button>
        ))}
      </div>

      {mode === "groups" && (
        <div className="flex flex-wrap gap-2">
          {groups.length === 0 && (
            <p className="text-xs text-muted-foreground">No groups yet — create one on the People page.</p>
          )}
          {groups.map((g) => {
            const selected = value.type === "groups" && value.ids.includes(g.id)
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => toggleGroup(g.id)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  selected
                    ? "border-foreground bg-foreground text-background"
                    : "border-input text-muted-foreground hover:text-foreground"
                )}
              >
                {g.name} <span className="opacity-60">({g.member_count})</span>
              </button>
            )
          })}
        </div>
      )}

      {mode === "tags" && (
        <div className="flex flex-wrap gap-2">
          {tags.length === 0 && <p className="text-xs text-muted-foreground">No tags yet.</p>}
          {tags.map((t) => {
            const selected = value.type === "tags" && value.names.includes(t.name)
            return (
              <button
                key={t.name}
                type="button"
                onClick={() => toggleTag(t.name)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  selected
                    ? "border-foreground bg-foreground text-background"
                    : "border-input text-muted-foreground hover:text-foreground"
                )}
              >
                {t.name} <span className="opacity-60">({t.inUse})</span>
              </button>
            )
          })}
        </div>
      )}

      {mode === "people" && (
        <div className="space-y-2">
          {selectedPeopleList.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedPeopleList.map((p) => (
                <Badge key={p.id} variant="outline" className="gap-1 pr-1">
                  {personLabel(p)}
                  <button
                    type="button"
                    onClick={() => togglePerson(p)}
                    aria-label={`Remove ${personLabel(p)}`}
                    className="rounded-full hover:bg-muted"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search subscribers by name or email…"
              className="pl-8 h-9 text-sm"
            />
          </div>
          <div className="max-h-40 overflow-y-auto rounded-md border border-input">
            {searching ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">Searching…</p>
            ) : searchResults.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                {search ? "No matches" : "Type to search subscribers"}
              </p>
            ) : (
              searchResults.map((p) => {
                const checked = value.type === "people" && value.ids.includes(p.id)
                return (
                  <label
                    key={p.id}
                    className="flex cursor-pointer items-center gap-2 border-b border-input px-3 py-1.5 text-sm last:border-0 hover:bg-muted/40"
                  >
                    <Checkbox checked={checked} onCheckedChange={() => togglePerson(p)} />
                    <span className="truncate">{personLabel(p)}</span>
                    {p.first_name && <span className="truncate text-xs text-muted-foreground">{p.email}</span>}
                  </label>
                )
              })
            )}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {count === null ? "Counting…" : `${count} ${count === 1 ? "person" : "people"} will get this`}
      </p>
    </div>
  )
}
