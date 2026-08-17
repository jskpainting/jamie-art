"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { updateSiteCopy } from "@/lib/actions/settings"

interface SiteCopyFieldFormProps {
  /** Which settings column this field saves to. */
  field: "tagline" | "commission_intro" | "contact_intro"
  label: string
  helper?: string
  /** Current effective text — saved value if set, otherwise the built-in default. */
  initialValue: string
  /** The built-in default text, used by "Reset to original text". */
  defaultText: string
  multiline?: boolean
  rows?: number
}

/**
 * One page-copy field, saved independently of every other field on the
 * Settings page. Always pre-filled with the real, currently-shown sentence
 * (never a blank box) — see lib/site-copy.ts.
 */
export function SiteCopyFieldForm({
  field,
  label,
  helper,
  initialValue,
  defaultText,
  multiline = false,
  rows = 4,
}: SiteCopyFieldFormProps) {
  const [value, setValue] = useState(initialValue)
  const [saving, setSaving] = useState(false)
  const id = `site-copy-${field}`

  async function handleSave() {
    setSaving(true)
    try {
      const result = await updateSiteCopy({ [field]: value })
      if (result.ok) {
        toast.success("Saved.", { duration: 5000 })
      } else {
        toast.error(result.error ?? "Failed to save.", { duration: 5000 })
      }
    } finally {
      setSaving(false)
    }
  }

  function handleReset() {
    setValue(defaultText)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {multiline ? (
        <Textarea
          id={id}
          rows={rows}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      ) : (
        <Input id={id} value={value} onChange={(e) => setValue(e.target.value)} />
      )}
      {helper && <p className="text-xs text-muted-foreground">{helper}</p>}
      <div className="flex items-center gap-4 pt-1">
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        <button
          type="button"
          onClick={handleReset}
          className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
        >
          Reset to original text
        </button>
      </div>
    </div>
  )
}
