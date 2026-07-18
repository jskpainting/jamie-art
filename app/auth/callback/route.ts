import { NextResponse } from "next/server"
import type { EmailOtpType } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { isAllowedAdmin } from "@/lib/supabase/auth"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null
  const rawNext = searchParams.get("next") ?? "/admin"
  // Open-redirect guard: only allow relative paths.
  const next = rawNext.startsWith("/") ? rawNext : "/admin"

  const supabase = await createClient()

  // Support both magic-link formats Supabase can send:
  //  - `?code=...`                (PKCE — same-browser only)
  //  - `?token_hash=...&type=...` (OTP — works cross-device, e.g. phone)
  let ok = false
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    ok = !error
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    })
    ok = !error
  }

  if (ok) {
    // Enforce the admin allowlist here too, so a non-admin who somehow
    // completes sign-in never keeps a lingering session.
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!isAllowedAdmin(user?.email)) {
      await supabase.auth.signOut()
      return NextResponse.redirect(
        new URL("/admin/login?error=not_allowed", request.url)
      )
    }
    return NextResponse.redirect(new URL(next, request.url))
  }

  return NextResponse.redirect(
    new URL("/admin/login?error=callback_failed", request.url)
  )
}
