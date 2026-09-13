// Turns whatever an upload path throws into plain-English copy for a toast.
// `headline` is safe to show as the toast title; `detail` carries the real
// technical message for anyone who wants it (the bulk uploader shows it
// behind a small info affordance).

export interface UploadErrorExplanation {
  headline: string
  detail: string
}

const HEIC_HINT = "iPhone: Settings → Camera → Formats → Most Compatible"

function getStatus(e: unknown): number | undefined {
  if (e && typeof e === "object" && "status" in e) {
    const s = (e as { status?: unknown }).status
    if (typeof s === "number") return s
  }
  return undefined
}

function getKind(e: unknown): string | undefined {
  if (e && typeof e === "object" && "kind" in e) {
    const k = (e as { kind?: unknown }).kind
    if (typeof k === "string") return k
  }
  return undefined
}

/** Detects a HEIC/HEIF file by MIME type or extension — browsers are inconsistent about reporting `file.type` for these. */
export function isHeicFile(file: File): boolean {
  const type = file.type.toLowerCase()
  const name = file.name.toLowerCase()
  return (
    type === "image/heic" ||
    type === "image/heif" ||
    name.endsWith(".heic") ||
    name.endsWith(".heif")
  )
}

export function explainUploadError(e: unknown): UploadErrorExplanation {
  const detail = e instanceof Error ? e.message : String(e)
  const lower = detail.toLowerCase()
  const status = getStatus(e)
  const kind = getKind(e)

  const offline = typeof navigator !== "undefined" && navigator.onLine === false
  if (offline || lower.includes("failed to fetch") || lower.includes("networkerror") || status === 0) {
    return { headline: "No internet connection", detail }
  }

  if (status === 401 || status === 403) {
    return { headline: "You've been signed out — sign in again and retry", detail }
  }

  if (status === 413 || kind === "size") {
    return { headline: "This photo is too big for the server", detail }
  }

  if (status === 415 || kind === "type" || /heic|heif/i.test(detail)) {
    return {
      headline: "This isn't a photo type we can use — JPEG, PNG or WebP only",
      detail: `${detail} — ${HEIC_HINT}`,
    }
  }

  if (kind === "abort" || lower.includes("timeout") || lower.includes("timed out") || lower.includes("cancelled")) {
    return { headline: "The upload took too long — weak signal? Try again", detail }
  }

  if (lower.includes("already exists")) {
    return {
      headline: "A file with this name already exists (try again — a new name is generated)",
      detail,
    }
  }

  if (lower.includes("bucket not found") || lower.includes("row-level security")) {
    return { headline: "The photo storage isn't set up right", detail: `technical: ${detail}` }
  }

  if (status !== undefined && status >= 500) {
    return { headline: "The server had a problem — try again in a minute", detail }
  }

  return { headline: "Upload failed", detail }
}
