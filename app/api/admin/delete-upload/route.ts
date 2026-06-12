import { NextRequest, NextResponse } from "next/server"
import { getUser } from "@/lib/supabase/auth"
import { createAdminClient } from "@/lib/supabase/admin"

const ALLOWED_BUCKETS = ["paintings", "headshots", "events", "site-images"] as const

export async function POST(request: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { path, bucket } = body as { path?: unknown; bucket?: unknown }

  if (typeof path !== "string" || !path.trim()) {
    return NextResponse.json({ error: "Missing path" }, { status: 400 })
  }
  if (
    typeof bucket !== "string" ||
    !(ALLOWED_BUCKETS as readonly string[]).includes(bucket)
  ) {
    return NextResponse.json({ error: "Invalid bucket" }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { error } = await supabase.storage.from(bucket).remove([path])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
