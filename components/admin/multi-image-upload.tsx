"use client"

import { useState, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import Image from "next/image"
import { Upload, X, Loader2, GripVertical } from "lucide-react"
import { toast } from "sonner"
import { IMAGE_PRESETS, type PresetKey } from "@/lib/image-presets"
import { IDENTITY_RECIPE, renderEdit } from "@/lib/image-edit"
import { cn } from "@/lib/utils"

const MAX_FILE_BYTES = 20 * 1024 * 1024 // 20 MB

interface SortableImageProps {
  id: string
  url: string
  onRemove: (id: string) => void
}

function SortableImage({ id, url, onRemove }: SortableImageProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <div className="relative aspect-square overflow-hidden border border-border">
        <Image src={url} alt="" fill className="object-cover" />
      </div>
      <button
        {...attributes}
        {...listeners}
        className="absolute top-1 left-1 bg-background/80 rounded p-0.5 text-muted-foreground cursor-grab active:cursor-grabbing touch-none opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-3 w-3" />
      </button>
      <button
        type="button"
        onClick={() => onRemove(id)}
        className="absolute top-1 right-1 bg-background/80 rounded p-0.5 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Remove image"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}

interface MultiImageItem {
  id: string
  url: string
}

interface MultiImageUploadProps {
  preset: PresetKey
  value: MultiImageItem[]
  onChange: (items: MultiImageItem[]) => void
  className?: string
}

export function MultiImageUpload({
  preset: presetKey,
  value,
  onChange,
  className,
}: MultiImageUploadProps) {
  const preset = IMAGE_PRESETS[presetKey]
  const [uploading, setUploading] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor))

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      setUploading(true)
      const results: MultiImageItem[] = []
      for (const file of acceptedFiles) {
        if (file.size > MAX_FILE_BYTES) {
          toast.error(`${file.name}: must be under 20 MB`)
          continue
        }
        try {
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.onerror = () => reject(new Error("Failed to read file"))
            reader.readAsDataURL(file)
          })
          // Extra painting photos never get cropped by this field — they're
          // just compressed to the same ceiling as every other painting photo.
          const rendered = await renderEdit(dataUrl, IDENTITY_RECIPE, preset.maxOutputPx)
          const formData = new FormData()
          formData.append("file", rendered.blob, "image.jpg")
          formData.append("bucket", preset.bucket)
          const res = await fetch("/api/admin/upload", { method: "POST", body: formData })
          const json = (await res.json()) as { url?: string; error?: string }
          if (!res.ok || !json.url) throw new Error(json.error ?? "Upload failed")
          results.push({ id: crypto.randomUUID(), url: json.url })
        } catch {
          toast.error(`${file.name}: upload failed — try again`)
        }
      }
      if (results.length > 0) onChange([...value, ...results])
      setUploading(false)
    },
    [preset, value, onChange]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/jpeg": [], "image/png": [], "image/webp": [] },
    disabled: uploading,
  })

  function handleRemove(id: string) {
    onChange(value.filter((item) => item.id !== id))
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = value.findIndex((i) => i.id === active.id)
    const newIndex = value.findIndex((i) => i.id === over.id)
    onChange(arrayMove(value, oldIndex, newIndex))
  }

  return (
    <div className={cn("space-y-3", className)}>
      {value.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={value.map((i) => i.id)}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {value.map((item) => (
                <SortableImage
                  key={item.id}
                  id={item.id}
                  url={item.url}
                  onRemove={handleRemove}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors",
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-muted/50",
          uploading && "pointer-events-none opacity-60"
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Upload className="h-5 w-5" />
          )}
          <p className="text-xs">
            {uploading
              ? "Uploading…"
              : isDragActive
              ? "Drop images here"
              : "Add more images"}
          </p>
        </div>
      </div>
    </div>
  )
}
