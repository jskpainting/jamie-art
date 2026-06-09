"use client"

import { useState } from "react"
import { toast } from "sonner"
import { createEvent, updateEvent } from "@/lib/actions/events"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FormField } from "@/components/admin/form-field"
import { ImageUpload } from "@/components/admin/image-upload"
import { MarkdownEditor } from "@/components/admin/markdown-editor"
import type { Event } from "@/lib/types"

function toDatetimeLocal(isoString: string): string {
  // Convert ISO string to datetime-local value (YYYY-MM-DDTHH:MM)
  return isoString.slice(0, 16)
}

interface EventFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  event?: Event
}

export function EventFormDialog({
  open,
  onOpenChange,
  event,
}: EventFormDialogProps) {
  const isEdit = !!event

  const [title, setTitle] = useState(event?.title ?? "")
  const [starts_at, setStartsAt] = useState(
    event ? toDatetimeLocal(event.starts_at) : ""
  )
  const [ends_at, setEndsAt] = useState(
    event?.ends_at ? toDatetimeLocal(event.ends_at) : ""
  )
  const [location, setLocation] = useState(event?.location ?? "")
  const [description, setDescription] = useState(event?.description ?? "")
  const [link, setLink] = useState(event?.link ?? "")
  const [image_url, setImageUrl] = useState<string | null>(
    event?.image_url ?? null
  )
  const [status, setStatus] = useState<"upcoming" | "past" | "cancelled">(
    event?.status ?? "upcoming"
  )
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  function validate() {
    const errs: Record<string, string> = {}
    if (!title.trim()) errs.title = "Title is required"
    if (!starts_at) errs.starts_at = "Start date is required"
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSave() {
    if (!validate()) return
    setSaving(true)
    try {
      const input = {
        title,
        starts_at: new Date(starts_at).toISOString(),
        ends_at: ends_at ? new Date(ends_at).toISOString() : null,
        location: location || null,
        description: description || null,
        link: link || null,
        image_url,
        status: status as "upcoming" | "past" | "cancelled",
      }

      const result = isEdit
        ? await updateEvent(event.id, input)
        : await createEvent(input)

      if (!result.ok) {
        toast.error(result.error)
      } else {
        toast.success(isEdit ? "Event saved" : "Event created")
        onOpenChange(false)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit event" : "Add event"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <FormField label="Title" required error={errors.title}>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Exhibition title"
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Start date" required error={errors.starts_at}>
              <Input
                type="datetime-local"
                value={starts_at}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </FormField>
            <FormField label="End date (optional)">
              <Input
                type="datetime-local"
                value={ends_at}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            </FormField>
          </div>

          <FormField label="Location">
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Gallery name, city"
            />
          </FormField>

          <FormField label="Link">
            <Input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://…"
              type="url"
            />
          </FormField>

          <FormField label="Status">
            <select
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as "upcoming" | "past" | "cancelled")
              }
              className="w-full h-8 rounded-lg border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="upcoming">Upcoming</option>
              <option value="past">Past</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </FormField>

          <FormField label="Description">
            <MarkdownEditor
              value={description}
              onChange={setDescription}
              placeholder="Event details…"
              rows={4}
            />
          </FormField>

          <FormField label="Image">
            <ImageUpload
              bucket="events"
              value={image_url}
              onChange={setImageUrl}
            />
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
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create event"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
