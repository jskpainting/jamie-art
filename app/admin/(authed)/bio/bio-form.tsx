"use client"

import { useState } from "react"
import { toast } from "sonner"
import { updateBio } from "@/lib/actions/bio"
import { ImageUpload } from "@/components/admin/image-upload"
import { MarkdownEditor } from "@/components/admin/markdown-editor"
import { FormField } from "@/components/admin/form-field"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { Bio } from "@/lib/types"

interface BioFormProps {
  bio: Bio | null
}

export function BioForm({ bio }: BioFormProps) {
  const [headshot_url, setHeadshot] = useState<string | null>(
    bio?.headshot_url ?? null
  )
  const [short_statement, setStatement] = useState(
    bio?.short_statement ?? ""
  )
  const [body_markdown, setBody] = useState(bio?.body_markdown ?? "")
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const result = await updateBio({
        headshot_url,
        short_statement: short_statement || null,
        body_markdown: body_markdown || null,
      })
      if (!result.ok) {
        toast.error(result.error)
      } else {
        toast.success("Bio saved")
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <FormField label="Headshot">
        <ImageUpload
          bucket="headshots"
          value={headshot_url}
          onChange={setHeadshot}
        />
      </FormField>

      <FormField label="Short statement">
        <Textarea
          value={short_statement}
          onChange={(e) => setStatement(e.target.value)}
          placeholder="One or two sentences about your work…"
          rows={3}
        />
      </FormField>

      <FormField label="Biography">
        <MarkdownEditor
          value={body_markdown}
          onChange={setBody}
          placeholder="Tell your story…"
          rows={12}
        />
      </FormField>

      <Button onClick={handleSave} disabled={saving}>
        {saving ? "Saving…" : "Save bio"}
      </Button>
    </div>
  )
}
