import { NextResponse, type NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { rateLimit, clientIp } from "@/lib/rate-limit"

// Public, unauthenticated, no-enumeration signal: "is passkey sign-in usable
// on this site right now?" — true only once the webauthn_credentials table
// exists AND at least one credential has been registered by ANY admin. This
// is what the login page's passkey button gates on (not just browser
// support), so pre-migration — or post-migration but before the owner has
// registered a first passkey — the button never renders and can never dead-end.
//
// Deliberately returns a single boolean and nothing else: no account email,
// no credential id, no count. Knowing "someone, somewhere has a passkey" is
// not enough to target or enumerate any specific admin account.
export async function GET(request: NextRequest) {
  if (!rateLimit(`passkey-availability:${clientIp(request)}`, { limit: 30, windowMs: 60_000 })) {
    return NextResponse.json({ available: false })
  }

  try {
    const supabase = createAdminClient()
    const { count, error } = await supabase
      .from("webauthn_credentials")
      .select("id", { count: "exact", head: true })

    if (error) {
      // Table not migrated yet (or any other read failure) — feature is
      // simply not usable. Never surface the underlying error.
      return NextResponse.json({ available: false })
    }

    return NextResponse.json({ available: (count ?? 0) > 0 })
  } catch {
    return NextResponse.json({ available: false })
  }
}
