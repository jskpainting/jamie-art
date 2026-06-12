"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { PaintingPicker } from "@/components/admin/painting-picker"
import { updateFeaturedPainting } from "@/lib/actions/settings"
import type { PaintingForPicker } from "@/lib/db/queries"

interface FeaturedPaintingPickerFormProps {
  paintings: PaintingForPicker[]
  initialId: string | null
}

export function FeaturedPaintingPickerForm({
  paintings,
  initialId,
}: FeaturedPaintingPickerFormProps) {
  const [selectedId, setSelectedId] = useState<string | null>(initialId)
  const [isPending, startTransition] = useTransition()

  function handleSelect(id: string | null) {
    setSelectedId(id)
    startTransition(async () => {
      const result = await updateFeaturedPainting(id)
      if (result.ok) {
        toast.success(id ? "Featured painting saved" : "Featured painting cleared", { duration: 5000 })
      } else {
        toast.error(result.error ?? "Failed to update", { duration: 5000 })
        setSelectedId(selectedId)
      }
    })
  }

  return (
    <div className={isPending ? "opacity-60 pointer-events-none" : undefined}>
      <PaintingPicker
        paintings={paintings}
        selectedId={selectedId}
        onSelect={handleSelect}
      />
    </div>
  )
}
