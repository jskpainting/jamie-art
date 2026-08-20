"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { updateQuickInquireSettings } from "@/lib/actions/settings"

interface QuickInquireFormProps {
  /** Current effective text — saved value if set, otherwise the built-in default. */
  initialMessage: string
  defaultMessage: string
  initialSmsEnabled: boolean
  hasPhone: boolean
}

/**
 * "When someone asks about a painting" card — the pre-filled message shown in
 * the "Ask about this painting" sheet, and whether visitors can send it as a
 * text message to the owner's phone. Saved together as one form (unlike the
 * per-field SiteCopyFieldForm cards) since the checkbox reads as a note on
 * the message, not a separate setting.
 */
export function QuickInquireForm({
  initialMessage,
  defaultMessage,
  initialSmsEnabled,
  hasPhone,
}: QuickInquireFormProps) {
  const [message, setMessage] = useState(initialMessage)
  const [smsEnabled, setSmsEnabled] = useState(initialSmsEnabled)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const result = await updateQuickInquireSettings({
        inquiry_message_template: message,
        inquiry_sms_enabled: smsEnabled,
      })
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
    setMessage(defaultMessage)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="inquiry-template">Pre-filled message</Label>
        <Textarea
          id="inquiry-template"
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Shown already filled in when a visitor taps &ldquo;Ask about this
          painting&rdquo; — they can still edit it before sending.{" "}
          <code className="rounded bg-muted px-1 py-0.5">{"{painting}"}</code>{" "}
          is swapped for the painting&rsquo;s name.
        </p>
        <button
          type="button"
          onClick={handleReset}
          className="w-fit text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
        >
          Reset to original text
        </button>
      </div>

      <label className="flex items-start gap-2.5 pt-1">
        <Checkbox
          checked={smsEnabled}
          onCheckedChange={(checked) => setSmsEnabled(checked === true)}
          className="mt-0.5"
        />
        <span className="text-sm">
          Let people send it as a text message to my phone
          <span className="block text-xs text-muted-foreground mt-0.5">
            {hasPhone
              ? "Uses the phone number below. Only shown to visitors on a phone."
              : "Add a phone number below to turn this on."}
          </span>
        </span>
      </label>

      <div className="pt-1">
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  )
}
