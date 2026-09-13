"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { X, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ConfirmDialog } from "@/components/admin/confirm-dialog"
import {
  addFieldOption,
  removeFieldOption,
  type FieldOptionRow,
} from "@/lib/actions/field-options"
import { FIELD_LABELS, type FieldOptionField } from "@/lib/field-options"

// Duplicated from lib/schema-capabilities.ts rather than imported — that
// module pulls in the server-only Supabase clients, which breaks the client
// bundle for this component.
const SCHEMA_SETUP_MESSAGE =
  "This feature needs a quick one-time setup that hasn't run yet — everything else works normally."

interface FieldOptionsCardProps {
  enabled: boolean
  initialOptions: Record<FieldOptionField, FieldOptionRow[]>
}

function OptionColumn({
  field,
  rows,
  onChanged,
}: {
  field: FieldOptionField
  rows: FieldOptionRow[]
  onChanged: () => void
}) {
  const [newValue, setNewValue] = useState("")
  const [adding, setAdding] = useState(false)
  const [removingValue, setRemovingValue] = useState<string | null>(null)

  async function handleAdd() {
    if (!newValue.trim()) return
    setAdding(true)
    try {
      const result = await addFieldOption(field, newValue)
      if (!result.ok) {
        toast.error(result.error ?? "Couldn't add that value", { duration: 5000 })
        return
      }
      setNewValue("")
      onChanged()
    } finally {
      setAdding(false)
    }
  }

  async function handleRemove(value: string) {
    setRemovingValue(value)
    try {
      const result = await removeFieldOption(field, value)
      if (!result.ok) {
        toast.error(result.error ?? "Couldn't remove that value", { duration: 5000 })
        return
      }
      onChanged()
    } finally {
      setRemovingValue(null)
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{FIELD_LABELS[field]}</p>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nothing here yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {rows.map((row) => {
            const removeButton = (
              <Button
                variant="ghost"
                size="icon-xs"
                disabled={removingValue === row.value}
                aria-label={`Remove ${row.value}`}
                onClick={row.inUse === 0 ? () => handleRemove(row.value) : undefined}
              >
                {removingValue === row.value ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <X className="h-3 w-3" />
                )}
              </Button>
            )
            return (
              <li
                key={row.value}
                className="flex items-center justify-between gap-2 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm truncate">{row.value}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.inUse > 0
                      ? `used on ${row.inUse} painting${row.inUse !== 1 ? "s" : ""}`
                      : "not used"}
                  </p>
                </div>
                {row.inUse > 0 ? (
                  <ConfirmDialog
                    trigger={removeButton}
                    title="Remove from the list?"
                    description="Paintings keep their value — it just won't be suggested any more."
                    confirmLabel="Remove"
                    destructive
                    onConfirm={() => handleRemove(row.value)}
                  />
                ) : (
                  removeButton
                )}
              </li>
            )
          })}
        </ul>
      )}
      <div className="flex items-center gap-2">
        <Input
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          placeholder={`Add a ${FIELD_LABELS[field].toLowerCase()}…`}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              handleAdd()
            }
          }}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleAdd}
          disabled={adding || !newValue.trim()}
        >
          {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add"}
        </Button>
      </div>
    </div>
  )
}

export function FieldOptionsCard({ enabled, initialOptions }: FieldOptionsCardProps) {
  const router = useRouter()

  if (!enabled) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">{SCHEMA_SETUP_MESSAGE}</p>
        <p className="text-xs text-muted-foreground">
          The Medium and Size dropdowns still work in the meantime — they&rsquo;re
          just built from what&rsquo;s already on your paintings instead of a
          managed list.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        These are the choices in the Medium and Size dropdowns when you add a
        painting. New values you type in are added automatically; most
        recently used come first.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <OptionColumn
          field="medium"
          rows={initialOptions.medium}
          onChanged={() => router.refresh()}
        />
        <OptionColumn
          field="dimensions"
          rows={initialOptions.dimensions}
          onChanged={() => router.refresh()}
        />
      </div>
    </div>
  )
}
