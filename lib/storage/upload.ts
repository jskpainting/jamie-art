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

  const form = new FormData()
  form.set("file", file)
  form.set("bucket", bucket)

  const res = await fetch("/api/admin/upload", { method: "POST", body: form })

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string }
    throw new UploadError("network", body.error ?? "Upload failed")
  }

  const data = await res.json() as { url: string; path: string }
  return { url: data.url, path: data.path }
}
