"use client"

import { useState } from "react"
import { toast } from "sonner"
import { updateSection } from "@/lib/actions/sections"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { FormField } from "@/components/admin/form-field"
import { ImageUpload } from "@/components/admin/image-upload"
import type { SectionWithCount } from "@/lib/types"

interface SectionEditButtonProps {
  section: SectionWithCount
}

export function SectionEditButton({ section }: SectionEditButtonProps) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(section.title)
  const [description, setDescription] = useState(section.description ?? "")
  const [cover_image_url, setCover] = useState<string | null>(
    section.cover_image_url
  )
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const result = await updateSection(section.id, {
        title,
        description: description || null,
        cover_image_url,
      })
      if (!result.ok) {
        toast.error(result.error)
      } else {
        toast.success("Section saved")
        setOpen(false)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Edit
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit {section.title}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <FormField label="Title" required>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Section title"
              />
            </FormField>

            <FormField label="Description">
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description (optional)"
                rows={2}
              />
            </FormField>

            <FormField label="Cover image">
              <ImageUpload
                bucket="paintings"
                value={cover_image_url}
                onChange={setCover}
              />
            </FormField>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !title.trim()}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
