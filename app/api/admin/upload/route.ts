import { NextRequest, NextResponse } from "next/server"
import { getUser } from "@/lib/supabase/auth"
import { createAdminClient } from "@/lib/supabase/admin"

const ALLOWED_BUCKETS = ["paintings", "headshots", "events", "site-images"] as const
const ALLOWED_FOLDERS = ["crops"] as const
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const
// 15 MB — comfortably above the cropper's compressed JPEG output (4000px / q0.95)
// so a valid crop never fails the upload after the user has already cropped it.
const MAX_SIZE = 15 * 1024 * 1024

type AllowedType = (typeof ALLOWED_TYPES)[number]

function extFromType(type: AllowedType): string {
  if (type === "image/jpeg") return "jpg"
  if (type === "image/png") return "png"
  return "webp"
}

export async function POST(request: NextRequest) {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 })
  }

  const file = formData.get("file")
  const bucket = formData.get("bucket")
  const folder = formData.get("folder")

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 })
  }
  if (typeof bucket !== "string" || !(ALLOWED_BUCKETS as readonly string[]).includes(bucket)) {
    return NextResponse.json({ error: "Invalid bucket" }, { status: 400 })
  }
  if (folder !== null && (typeof folder !== "string" || !(ALLOWED_FOLDERS as readonly string[]).includes(folder))) {
    return NextResponse.json({ error: "Invalid folder" }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File must be under 15 MB" }, { status: 400 })
  }
  if (!(ALLOWED_TYPES as readonly string[]).includes(file.type)) {
    return NextResponse.json(
      { error: "Only JPEG, PNG, and WebP images are allowed" },
      { status: 400 }
    )
  }

  const filename = `${crypto.randomUUID()}.${extFromType(file.type as AllowedType)}`
  const path = folder ? `${folder}/${filename}` : filename

  const supabase = createAdminClient()
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { contentType: file.type, upsert: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path)

  return NextResponse.json({ url: publicUrl, path })
}
