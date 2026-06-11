"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { createSection, updateSection } from "@/lib/actions/sections"
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
import { slugify } from "@/lib/utils"
import type { SectionWithCount } from "@/lib/types"

interface SectionFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  section?: SectionWithCount
}

// Inner component keyed by open+section so it remounts fresh each time the
// dialog opens — avoids calling setState inside a useEffect.
interface SectionFormInnerProps {
  section?: SectionWithCount
  onOpenChange: (open: boolean) => void
}

function SectionFormInner({ section, onOpenChange }: SectionFormInnerProps) {
  const isEdit = !!section
  const isUncategorized = section?.slug === "uncategorized"
  const router = useRouter()

  const [title, setTitle] = useState(section?.title ?? "")
  const [slug, setSlug] = useState(section?.slug ?? "")
  const [slugTouched, setSlugTouched] = useState(isEdit)
  const [description, setDescription] = useState(section?.description ?? "")
  const [coverUrl, setCoverUrl] = useState<string | null>(section?.cover_image_url ?? null)
  const [saving, setSaving] = useState(false)
  const [slugError, setSlugError] = useState("")

  function handleTitleChange(value: string) {
    setTitle(value)
    if (!slugTouched) {
      setSlug(slugify(value))
    }
  }

  function handleSlugChange(value: string) {
    setSlugTouched(true)
    setSlug(value)
    if (value && !/^[a-z0-9-]+$/.test(value)) {
      setSlugError("Lowercase letters, numbers, and hyphens only")
    } else {
      setSlugError("")
    }
  }

  async function handleSave() {
    if (!title.trim()) return
    if (!slug.trim() || !/^[a-z0-9-]+$/.test(slug)) return

    setSaving(true)
    try {
      const input = {
        title: title.trim(),
        slug: slug.trim(),
        description: description.trim() || null,
        cover_image_url: coverUrl,
      }
      const result = isEdit
        ? await updateSection(section!.id, input)
        : await createSection(input)

      if (!result.ok) {
        toast.error(result.error)
      } else {
        toast.success(isEdit ? "Section saved" : "Section created")
        onOpenChange(false)
        router.refresh()
      }
    } finally {
      setSaving(false)
    }
  }

  const canSave =
    title.trim().length > 0 &&
    slug.trim().length > 0 &&
    /^[a-z0-9-]+$/.test(slug) &&
    !saving

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEdit ? `Edit ${section!.title}` : "New section"}</DialogTitle>
      </DialogHeader>

      <div className="space-y-4 py-2">
        <FormField label="Title" required>
          <Input
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Section title"
          />
        </FormField>

        <FormField label="Slug" required error={slugError || undefined}>
          <Input
            value={slug}
            onChange={(e) => handleSlugChange(e.target.value)}
            placeholder="section-slug"
            disabled={isUncategorized}
            className={
              isUncategorized
                ? "opacity-50 cursor-not-allowed"
                : slugError
                  ? "border-destructive"
                  : ""
            }
          />
          {isUncategorized && (
            <p className="text-xs text-muted-foreground mt-1">
              Slug can&apos;t be changed for this section.
            </p>
          )}
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
          <ImageUpload bucket="paintings" value={coverUrl} onChange={setCoverUrl} />
        </FormField>
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={!canSave}>
          {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
          {saving ? "Saving…" : isEdit ? "Save" : "Create"}
        </Button>
      </DialogFooter>
    </>
  )
}

export function SectionFormDialog({
  open,
  onOpenChange,
  section,
}: SectionFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <SectionFormInner
          key={open ? (section?.id ?? "new") : "closed"}
          section={section}
          onOpenChange={onOpenChange}
        />
      </DialogContent>
    </Dialog>
  )
}
