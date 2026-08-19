import { NextResponse } from "next/server"
import { generateRegistrationOptions } from "@simplewebauthn/server"
import type { AuthenticatorTransportFuture } from "@simplewebauthn/server"
import { getUser } from "@/lib/supabase/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  CHALLENGE_COOKIE,
  PURPOSE_REGISTER,
  challengeCookieOptions,
  rpId,
  rpName,
  signChallengeCookie,
} from "@/lib/passkeys/server"

// Session-gated: a passkey can only ever be attached to the account that is
// already authenticated in this browser (security requirement #3).
export async function POST() {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { data: existing } = await supabase
    .from("webauthn_credentials")
    .select("credential_id, transports")
    .eq("user_id", user.id)

  const options = await generateRegistrationOptions({
    rpName: rpName(),
    rpID: rpId(),
    userID: new TextEncoder().encode(user.id),
    userName: user.email ?? user.id,
    userDisplayName: user.email ?? "Admin",
    attestationType: "none",
    excludeCredentials: (existing ?? []).map((c) => ({
      id: c.credential_id as string,
      transports: (c.transports ?? undefined) as AuthenticatorTransportFuture[] | undefined,
    })),
    // Resident/discoverable key so the same credential can drive the
    // usernameless sign-in flow later; "preferred" (not "required") keeps
    // older/Android authenticators from being rejected outright.
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  })

  const token = signChallengeCookie(options.challenge, PURPOSE_REGISTER, user.id)
  const res = NextResponse.json(options)
  res.cookies.set(CHALLENGE_COOKIE, token, challengeCookieOptions())
  return res
}
