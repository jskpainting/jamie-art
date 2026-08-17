"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { updateBio } from "@/lib/actions/bio"
import { ImageUploadCropper } from "@/components/admin/image-upload-cropper"
import { FocalPointPicker } from "@/components/admin/focal-point-picker"
import { MarkdownEditor } from "@/components/admin/markdown-editor"
import { FormField } from "@/components/admin/form-field"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { Bio } from "@/lib/types"

interface BioFormProps {
  bio: Bio | null
  showFocal?: boolean
}

export function BioForm({ bio, showFocal }: BioFormProps) {
  const [headshot_url, setHeadshot] = useState<string | null>(
    bio?.headshot_url ?? null
  )
  const [short_statement, setStatement] = useState(
    bio?.short_statement ?? ""
  )
  const [body_markdown, setBody] = useState(bio?.body_markdown ?? "")
  const [focal, setFocal] = useState({
    x: bio?.headshot_focal_x ?? 50,
    y: bio?.headshot_focal_y ?? 50,
  })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const result = await updateBio({
        headshot_url,
        short_statement: short_statement || null,
        body_markdown: body_markdown || null,
        headshot_focal_x: focal.x,
        headshot_focal_y: focal.y,
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

  // Focal point changes save immediately (own debounce), independent of the
  // "Save bio" button, matching the settings image fields.
  async function handleFocalChange(x: number, y: number) {
    setFocal({ x, y })
    const result = await updateBio({
      headshot_url,
      short_statement: short_statement || null,
      body_markdown: body_markdown || null,
      headshot_focal_x: x,
      headshot_focal_y: y,
    })
    if (!result.ok) toast.error(result.error)
  }

  return (
    <div className="max-w-2xl space-y-6">
      <FormField label="Headshot (portrait, 4:5)">
        <ImageUploadCropper
          bucket="headshots"
          currentImageUrl={headshot_url}
          aspectRatio={4 / 5}
          label="Headshot"
          onUploadComplete={(url) => setHeadshot(url)}
        />
        {showFocal && headshot_url && (
          <div className="mt-4">
            <FocalPointPicker
              imageUrl={headshot_url}
              focalX={focal.x}
              focalY={focal.y}
              onChange={handleFocalChange}
            />
          </div>
        )}
      </FormField>

      <FormField label="Short statement">
        <Textarea
          value={short_statement}
          onChange={(e) => setStatement(e.target.value)}
          placeholder="One or two sentences about your work…"
          rows={3}
          className="font-sans"
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
        {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
        {saving ? "Saving…" : "Save bio"}
      </Button>
    </div>
  )
}
