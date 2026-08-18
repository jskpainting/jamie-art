import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isAllowedAdmin } from "@/lib/supabase/auth"

// Called right after a client-side supabase.auth.signInWithPassword()
// succeeds, to enforce the ADMIN_EMAILS allowlist and, if the signed-in
// account isn't on it, sign the session out server-side — mirroring the
// magic-link callback's behavior (app/auth/callback/route.ts). The email in
// the request body is informational only; the real check reads the actual
// authenticated session from cookies, so this can't be spoofed into
// approving a different account.
export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const allowed = isAllowedAdmin(user?.email)
  if (!allowed) {
    await supabase.auth.signOut()
  }

  return NextResponse.json({ allowed })
}
