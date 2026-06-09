import { createClient } from "@/lib/supabase/client"

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const
const MAX_SIZE = 10 * 1024 * 1024 // 10 MB

type AllowedType = (typeof ALLOWED_TYPES)[number]

export type UploadErrorKind = "size" | "type" | "network"

export class UploadError extends Error {
  kind: UploadErrorKind
  constructor(kind: UploadErrorKind, message: string) {
    super(message)
    this.kind = kind
    this.name = "UploadError"
  }
}

export interface UploadResult {
  url: string
  path: string
}

function extFromType(type: AllowedType): string {
  if (type === "image/jpeg") return "jpg"
  if (type === "image/png") return "png"
  return "webp"
}

export async function uploadImage(
  bucket: string,
  file: File
): Promise<UploadResult> {
  if (file.size > MAX_SIZE) {
    throw new UploadError("size", "File must be under 10 MB")
  }

  if (!ALLOWED_TYPES.includes(file.type as AllowedType)) {
    throw new UploadError("type", "Only JPEG, PNG, and WebP images are allowed")
  }

  const ext = extFromType(file.type as AllowedType)
  const path = `${crypto.randomUUID()}.${ext}`

  const supabase = createClient()
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type,
    upsert: false,
  })

  if (error) {
    throw new UploadError("network", error.message)
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(path)

  return { url: publicUrl, path }
}
