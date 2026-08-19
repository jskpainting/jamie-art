import { NextResponse } from "next/server"
import { getUser } from "@/lib/supabase/auth"
import { createAdminClient } from "@/lib/supabase/admin"

// Session-gated and scoped to user_id, so a passkey belonging to another
// account can never be deleted (the .eq("user_id", ...) below is load-bearing,
// not decorative — id alone is not enough). Password + magic-link always
// remain as sign-in methods, so deleting the account's last passkey is never
// blocked.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { id } = await params
  const supabase = createAdminClient()
  const { error } = await supabase
    .from("webauthn_credentials")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)

  if (error) {
    return NextResponse.json({ error: "Could not delete passkey." }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
