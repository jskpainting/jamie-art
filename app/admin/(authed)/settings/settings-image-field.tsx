"use client"

import { toast } from "sonner"
import { ImageUploadCropper } from "@/components/admin/image-upload-cropper"
import { updateSettingImage } from "@/lib/actions/settings"

type ImageField = "home_hero_image_url" | "commission_image_url"

interface Props {
  label: string
  aspectRatio: number
  currentImageUrl: string | null
  bucket: "headshots" | "site-images"
  field: ImageField
  hintText?: string
}

export function SettingsImageField({
  label,
  aspectRatio,
  currentImageUrl,
  bucket,
  field,
  hintText,
}: Props) {
  async function handleComplete(url: string | null) {
    const result = await updateSettingImage(field, url)
    if (!result.ok) {
      toast.error(result.error ?? "Save failed", { duration: 5000 })
      return
    }
    toast.success(url ? `${label} saved.` : `${label} removed.`, { duration: 5000 })
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
    </div>
  )
}
