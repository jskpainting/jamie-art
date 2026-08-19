import { NextResponse, type NextRequest } from "next/server"
import { verifyAuthenticationResponse } from "@simplewebauthn/server"
import type { AuthenticationResponseJSON, AuthenticatorTransportFuture } from "@simplewebauthn/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { isAllowedAdmin } from "@/lib/supabase/auth"
import { rateLimit, clientIp } from "@/lib/rate-limit"
import {
  CHALLENGE_COOKIE,
  PURPOSE_AUTH,
  clearedChallengeCookieOptions,
  expectedOrigins,
  readChallengeCookie,
  rpId,
} from "@/lib/passkeys/server"

// Generic failure for every ceremony error — never reveals which check
// failed, so this endpoint can't be used to enumerate accounts or probe
// which credential ids exist (security requirement #5).
const INVALID = { error: "Passkey verification failed." }

interface Body {
  credential?: AuthenticationResponseJSON
}

function fail(status: number) {
  const res = NextResponse.json(INVALID, { status })
  res.cookies.set(CHALLENGE_COOKIE, "", clearedChallengeCookieOptions())
  return res
}

// Public endpoint — passwordless sign-in. Rate-limited (security requirement
// #6), usernameless (#5), re-checks the admin allowlist before minting a
// session (#1), and rejects a non-advancing signature counter (#4).
export async function POST(request: NextRequest) {
  if (!rateLimit(`passkey-auth:${clientIp(request)}`, { limit: 10, windowMs: 60_000 })) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again shortly." },
      { status: 429 }
    )
  }

  let body: Body
  try {
    body = await request.json()
  } catch {
    return fail(400)
  }
  const cred = body?.credential
  if (!cred || typeof cred.id !== "string" || !cred.id) return fail(400)

  const token = request.cookies.get(CHALLENGE_COOKIE)?.value
  // Challenge is server-generated, signed, single-use, TTL-bounded, and
  // purpose-bound — never trusted from a client-echoed value (requirement #2).
  const challenge = readChallengeCookie(token, PURPOSE_AUTH)
  if (!challenge) return fail(400)

  const supabase = createAdminClient()

  // The client-supplied credential id is the LOOKUP key only — the account is
  // resolved entirely from the stored row, never from anything the client
  // asserts about who it is.
  const { data: row } = await supabase
    .from("webauthn_credentials")
    .select("id, user_id, credential_id, public_key, counter, transports")
    .eq("credential_id", cred.id)
    .maybeSingle()
  if (!row) return fail(400)

  let verification
  try {
    verification = await verifyAuthenticationResponse({
      response: cred,
      expectedChallenge: challenge,
      expectedOrigin: expectedOrigins(),
      expectedRPID: rpId(),
      credential: {
        id: row.credential_id,
        publicKey: Buffer.from(row.public_key, "base64url"),
        counter: row.counter,
        transports: (row.transports ?? undefined) as AuthenticatorTransportFuture[] | undefined,
      },
    })
  } catch {
    return fail(400)
  }
  if (!verification.verified) return fail(400)

  const { newCounter } = verification.authenticationInfo
  // Signature counter regression = possible cloned authenticator. Reject and
  // leave the stored counter untouched (requirement #4).
  if (row.counter > 0 && newCounter <= row.counter) return fail(400)

  const { data: userData, error: userErr } = await supabase.auth.admin.getUserById(row.user_id)
  const email = userData?.user?.email
  // Re-check the ADMIN_EMAILS allowlist right before minting a session — a
  // passkey proves device possession, not standing admin authorization
  // (requirement #1).
  if (userErr || !email || !isAllowedAdmin(email)) return fail(400)

  await supabase
    .from("webauthn_credentials")
    .update({ counter: newCounter, last_used_at: new Date().toISOString() })
    .eq("id", row.id)

  // Establish a real Supabase session with no email sent: mint a magic-link
  // token server-side via the admin API, then redeem it immediately on a
  // cookie-bound server client so the session cookies land on this response.
  const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
  })
  const hashedToken = linkData?.properties?.hashed_token
  if (linkErr || !hashedToken) return fail(400)

  const sessionClient = await createServerClient()
  const { error: verifyErr } = await sessionClient.auth.verifyOtp({
    token_hash: hashedToken,
    type: "magiclink",
  })
  if (verifyErr) return fail(400)

  const res = NextResponse.json({ ok: true })
  res.cookies.set(CHALLENGE_COOKIE, "", clearedChallengeCookieOptions())
  return res
}
