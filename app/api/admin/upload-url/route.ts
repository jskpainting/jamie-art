import { NextRequest, NextResponse } from "next/server"
import { getUser } from "@/lib/supabase/auth"
import { createAdminClient } from "@/lib/supabase/admin"

// Kept identical to `/api/admin/upload`'s allowlists so the two routes never
// drift — this one only ever hands back a signed URL, the actual bytes go
// straight from the browser to Supabase Storage.
const ALLOWED_BUCKETS = ["paintings", "headshots", "events", "site-images"] as const
const ALLOWED_FOLDERS = ["crops"] as const
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const

type AllowedType = (typeof ALLOWED_TYPES)[number]

function extFromType(type: AllowedType): string {
  if (type === "image/jpeg") return "jpg"
  if (type === "image/png") return "png"
  return "webp"
}

export async function POST(request: NextRequest) {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized", code: "unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON", code: "bad-type" }, { status: 400 })
  }

  const { bucket, contentType, folder } = (body ?? {}) as {
    bucket?: unknown
    contentType?: unknown
    folder?: unknown
  }

  if (typeof bucket !== "string" || !(ALLOWED_BUCKETS as readonly string[]).includes(bucket)) {
    return NextResponse.json({ error: "Invalid bucket", code: "bad-bucket" }, { status: 400 })
  }
  if (typeof contentType !== "string" || !(ALLOWED_TYPES as readonly string[]).includes(contentType)) {
    return NextResponse.json(
      { error: "Only JPEG, PNG, and WebP images are allowed", code: "bad-type" },
      { status: 400 }
    )
  }
  if (
    folder !== undefined &&
    folder !== null &&
    (typeof folder !== "string" || !(ALLOWED_FOLDERS as readonly string[]).includes(folder))
  ) {
    return NextResponse.json({ error: "Invalid folder", code: "bad-type" }, { status: 400 })
  }

  const filename = `${crypto.randomUUID()}.${extFromType(contentType as AllowedType)}`
  const path = folder ? `${folder as string}/${filename}` : filename

  const supabase = createAdminClient()
  const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(path)

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Could not start the upload", code: "storage" },
      { status: 500 }
    )
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(data.path)

  return NextResponse.json({ path: data.path, token: data.token, publicUrl })
}
