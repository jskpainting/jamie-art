"use client"

import { useState } from "react"
import { toast } from "sonner"
import { ImageUploadCropper } from "@/components/admin/image-upload-cropper"
import { FocalPointPicker } from "@/components/admin/focal-point-picker"
import { updateSettingImage, updateSettingFocal } from "@/lib/actions/settings"

type ImageField = "home_hero_image_url" | "commission_image_url"

interface Props {
  label: string
  aspectRatio: number | "free"
  currentImageUrl: string | null
  bucket: "headshots" | "site-images"
  field: ImageField
  hintText?: string
  focalX?: number
  focalY?: number
  showFocal?: boolean
}

export function SettingsImageField({
  label,
  aspectRatio,
  currentImageUrl,
  bucket,
  field,
  hintText,
  focalX,
  focalY,
  showFocal,
}: Props) {
  const [imageUrl, setImageUrl] = useState(currentImageUrl)

  async function handleComplete(url: string | null) {
    setImageUrl(url)
    const result = await updateSettingImage(field, url)
    if (!result.ok) {
      toast.error(result.error ?? "Save failed", { duration: 5000 })
      return
    }
    toast.success(url ? `${label} saved.` : `${label} removed.`, { duration: 5000 })
  }

  async function handleFocalChange(x: number, y: number) {
    const result = await updateSettingFocal(field, x, y)
    if (!result.ok) {
      toast.error(result.error ?? "Save failed", { duration: 5000 })
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hintText && (
          <p className="text-xs text-muted-foreground mt-0.5">{hintText}</p>
        )}
      </div>
      <ImageUploadCropper
        currentImageUrl={currentImageUrl}
        aspectRatio={aspectRatio}
        bucket={bucket}
        onUploadComplete={handleComplete}
        label={label}
      />
      {showFocal && imageUrl && (
        <FocalPointPicker
          key={imageUrl}
          imageUrl={imageUrl}
          focalX={focalX ?? 50}
          focalY={focalY ?? 50}
          onChange={handleFocalChange}
        />
      )}
    </div>
  )
}
