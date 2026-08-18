import { NextResponse } from "next/server"
import type { EmailOtpType } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { isAllowedAdmin } from "@/lib/supabase/auth"
import { safeNext } from "@/lib/safe-next"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null
  // Password-recovery links land here with type=recovery. They're handled the
  // same way as any other OTP below (verifyOtp), but we route the signed-in
  // user to /admin/account by default so they land where they can actually
  // set a new password, instead of the normal /admin dashboard.
  const rawNext =
    searchParams.get("next") ?? (type === "recovery" ? "/admin/account" : "/admin")
  const next = safeNext(rawNext)

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
