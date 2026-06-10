"use client"

import { useState, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import { useReducedMotion } from "framer-motion"
import Image from "next/image"
import { Upload, X, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { uploadImage, UploadError } from "@/lib/storage/upload"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ImageUploadProps {
  bucket: string
  value: string | null
  onChange: (url: string | null) => void
  className?: string
}

export function ImageUpload({
  bucket,
  value,
  onChange,
  className,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false)
  const reduceMotion = useReducedMotion()

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0]
      if (!file) return
      setUploading(true)
      try {
        const result = await uploadImage(bucket, file)
        onChange(result.url)
      } catch (e) {
        if (e instanceof UploadError) {
          if (e.kind === "size") toast.error("File must be under 10 MB")
          else if (e.kind === "type")
            toast.error("Only JPEG, PNG, and WebP images are allowed")
          else toast.error("Upload failed — try again")
        } else {
          toast.error("Upload failed — try again")
        }
      } finally {
        setUploading(false)
      }
    },
    [bucket, onChange]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/jpeg": [], "image/png": [], "image/webp": [] },
    maxFiles: 1,
    disabled: uploading,
  })

  if (value) {
    return (
      <div className={cn("relative", className)}>
        <div
          className="relative rounded-lg overflow-hidden border border-border"
          style={{ height: 160 }}
        >
          <Image
            src={value}
            alt="Uploaded image"
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className={cn(
              "object-cover",
              !reduceMotion && "transition-opacity duration-200"
            )}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={() => onChange(null)}
        >
          <X className="h-3 w-3 mr-1" /> Remove
        </Button>
      </div>
    )
  }

  return (
    <div
      {...getRootProps()}
      className={cn(
        "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
        isDragActive
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/50 hover:bg-muted/50",
        uploading && "pointer-events-none opacity-60",
        className
      )}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center gap-2 text-muted-foreground">
        {uploading ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : (
          <Upload className="h-6 w-6" />
        )}
        <p className="text-sm">
          {uploading
            ? "Uploading…"
            : isDragActive
            ? "Drop image here"
            : "Drag & drop or click to select"}
        </p>
        <p className="text-xs">JPEG, PNG, WebP · max 10 MB</p>
      </div>
    </div>
  )
}
