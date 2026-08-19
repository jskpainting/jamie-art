import { NextResponse } from "next/server"
import { getUser } from "@/lib/supabase/auth"
import { createAdminClient } from "@/lib/supabase/admin"

// Session-gated: lists only the signed-in admin's own passkeys.
export async function GET() {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("webauthn_credentials")
    .select("id, device_label, created_at, last_used_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ passkeys: [] })
  }

  return NextResponse.json({ passkeys: data ?? [] })
}
