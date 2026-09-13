"use client"

// Uploads go straight to Supabase Storage via a signed URL — Vercel's
// serverless functions reject bodies over ~4.5 MB before `/api/admin/upload`
// ever runs, which is why phone photos used to fail about half the time.
// `/api/admin/upload-url` only ever hands back `{ path, token, publicUrl }`;
// the bytes travel browser → Supabase directly.

import { shrinkImage } from "@/lib/image-shrink"

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const
// Generous — everything is shrunk client-side before this is checked against
// the *original* file, so this just catches something absurd (a 200 MP RAW).
const MAX_SIZE = 40 * 1024 * 1024 // 40 MB

type AllowedType = (typeof ALLOWED_TYPES)[number]

export type UploadErrorKind = "size" | "type" | "network" | "abort"

export class UploadError extends Error {
  kind: UploadErrorKind
  status?: number
  constructor(kind: UploadErrorKind, message: string, status?: number) {
    super(message)
    this.kind = kind
    this.status = status
    this.name = "UploadError"
  }
}

export interface UploadOpts {
  folder?: "crops"
  onProgress?: (pct: number) => void
  signal?: AbortSignal
  /** Ceiling for the long edge of the shrunk output. Defaults to 4000px. */
  maxPx?: number
}

export interface UploadResult {
  url: string
  path: string
  width: number
  height: number
}

interface SignedUrlResponse {
  path: string
  token: string
  publicUrl: string
}

interface SignedUrlErrorResponse {
  error?: string
  code?: string
}

const RETRY_DELAYS_MS = [1000, 3000, 8000]

function isRetryableStatus(status: number): boolean {
  // Never retry auth/payload/type errors — retrying won't fix them.
  if (status === 401 || status === 403 || status === 413 || status === 415) return false
  return status === 0 || status >= 500
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function requestSignedUrl(
  bucket: string,
  contentType: string,
  folder?: "crops"
): Promise<SignedUrlResponse> {
  const res = await fetch("/api/admin/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bucket, contentType, folder }),
  })
  const json = (await res.json().catch(() => ({}))) as Partial<SignedUrlResponse> &
    SignedUrlErrorResponse
  if (!res.ok || !json.path || !json.token || !json.publicUrl) {
    throw new UploadError("network", json.error ?? "Could not start the upload", res.status)
  }
  return { path: json.path, token: json.token, publicUrl: json.publicUrl }
}

function putWithProgress(
  url: string,
  blob: Blob,
  onProgress?: (pct: number) => void,
  signal?: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new UploadError("abort", "Upload cancelled"))
      return
    }

    const xhr = new XMLHttpRequest()
    xhr.open("PUT", url)
    xhr.setRequestHeader("Content-Type", "image/jpeg")
    xhr.setRequestHeader("x-upsert", "false")
    xhr.timeout = 60_000

    const onAbort = () => xhr.abort()
    signal?.addEventListener("abort", onAbort)

    const cleanup = () => signal?.removeEventListener("abort", onAbort)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      cleanup()
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100)
        resolve()
      } else {
        reject(new UploadError("network", `Upload failed (${xhr.status})`, xhr.status))
      }
    }
    xhr.onerror = () => {
      cleanup()
      reject(new UploadError("network", "Failed to fetch", 0))
    }
    xhr.ontimeout = () => {
      cleanup()
      reject(new UploadError("abort", "Upload timed out", 0))
    }
    xhr.onabort = () => {
      cleanup()
      reject(new UploadError("abort", "Upload cancelled"))
    }
    xhr.send(blob)
  })
}

/** Signed-URL upload of an already-rendered JPEG blob — no shrinking. Used by callers (cropper, multi-image field) that already compressed via the crop pipeline. */
export async function uploadBlob(
  bucket: string,
  blob: Blob,
  opts: UploadOpts = {}
): Promise<{ url: string; path: string }> {
  let lastError: unknown
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const signed = await requestSignedUrl(bucket, "image/jpeg", opts.folder)
      const base = process.env.NEXT_PUBLIC_SUPABASE_URL
      const putUrl = `${base}/storage/v1/object/upload/sign/${bucket}/${signed.path}?token=${signed.token}`
      await putWithProgress(putUrl, blob, opts.onProgress, opts.signal)
      return { url: signed.publicUrl, path: signed.path }
    } catch (e) {
      lastError = e
      if (opts.signal?.aborted) throw e
      const status = e instanceof UploadError ? e.status : undefined
      const retryable = status === undefined || isRetryableStatus(status)
      if (!retryable || attempt === RETRY_DELAYS_MS.length) throw e
      await sleep(RETRY_DELAYS_MS[attempt])
    }
  }
  throw lastError
}

/**
 * Shrinks `file` client-side, then uploads it via a signed URL with progress
 * and automatic retry. This is the path every raw file-picker selection
 * should go through — the cropper and multi-image field pre-render their own
 * blob and call `uploadBlob` directly instead.
 */
export async function uploadImage(
  bucket: string,
  file: File,
  opts: UploadOpts = {}
): Promise<UploadResult> {
  if (file.size > MAX_SIZE) {
    throw new UploadError("size", "File must be under 40 MB", 413)
  }
  if (!ALLOWED_TYPES.includes(file.type as AllowedType)) {
    throw new UploadError("type", "Only JPEG, PNG, and WebP images are allowed", 415)
  }

  const shrunk = await shrinkImage(file, opts.maxPx ?? 4000)
  const { url, path } = await uploadBlob(bucket, shrunk.blob, opts)
  return { url, path, width: shrunk.width, height: shrunk.height }
}
