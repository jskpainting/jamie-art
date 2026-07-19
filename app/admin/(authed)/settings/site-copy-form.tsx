"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { updateSiteCopy } from "@/lib/actions/settings"
import type { Settings } from "@/lib/types"

interface SiteCopyFormProps {
  initialValues: Settings | null
}

export function SiteCopyForm({ initialValues }: SiteCopyFormProps) {
  const [tagline, setTagline] = useState(initialValues?.tagline ?? "")
  const [commissionIntro, setCommissionIntro] = useState(
    initialValues?.commission_intro ?? ""
  )
  const [contactIntro, setContactIntro] = useState(
    initialValues?.contact_intro ?? ""
  )
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const result = await updateSiteCopy({
        tagline,
        commission_intro: commissionIntro,
        contact_intro: contactIntro,
      })
      if (result.ok) {
        toast.success("Site copy saved.", { duration: 5000 })
      } else {
        toast.error(result.error ?? "Failed to save site copy.", {
          duration: 5000,
        })
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tagline">Tagline</Label>
        <Input
          id="tagline"
          placeholder="Painter · Boston"
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Shown under your name in the menu and hero. Leave blank to use the
          default (&ldquo;Painter · Boston&rdquo;).
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="commission_intro">Commission page intro</Label>
        <Textarea
          id="commission_intro"
          rows={3}
          placeholder="Tell visitors how commissions work…"
          value={commissionIntro}
          onChange={(e) => setCommissionIntro(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          The paragraph under the Commission heading. Leave blank for the
          default copy.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="contact_intro">Contact page intro</Label>
        <Textarea
          id="contact_intro"
          rows={3}
          placeholder="A friendly note above the contact form…"
          value={contactIntro}
          onChange={(e) => setContactIntro(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          The paragraph above the contact form. Leave blank for the default
          copy.
        </p>
      </div>

      <div className="pt-1">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save site copy"}
        </Button>
      </div>
    </div>
  )
}
