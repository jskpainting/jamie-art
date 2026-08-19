import { NextResponse, type NextRequest } from "next/server"
import { verifyRegistrationResponse } from "@simplewebauthn/server"
import type { RegistrationResponseJSON } from "@simplewebauthn/server"
import { getUser } from "@/lib/supabase/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  CHALLENGE_COOKIE,
  PURPOSE_REGISTER,
  clearedChallengeCookieOptions,
  expectedOrigins,
  readChallengeCookie,
  rpId,
} from "@/lib/passkeys/server"

// Generic failure — identical for every ceremony error so nothing about
// credential existence or which check failed is ever leaked.
const INVALID = { error: "Passkey verification failed." }

interface Body {
  credential?: RegistrationResponseJSON
  device_label?: string
}

function fail(status: number) {
  const res = NextResponse.json(INVALID, { status })
  // Challenge is single-use — always cleared, on success or failure.
  res.cookies.set(CHALLENGE_COOKIE, "", clearedChallengeCookieOptions())
  return res
}

// Session-gated: finishes attaching a passkey to the account that began the
// ceremony (bound by user id in the signed challenge cookie, checked below).
export async function POST(request: NextRequest) {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  let body: Body
  try {
    body = await request.json()
  } catch {
    return fail(400)
  }
  if (!body?.credential) return fail(400)

  const token = request.cookies.get(CHALLENGE_COOKIE)?.value
  const challenge = readChallengeCookie(token, PURPOSE_REGISTER, user.id)
  if (!challenge) return fail(400)

  let verification
  try {
    verification = await verifyRegistrationResponse({
      response: body.credential,
      expectedChallenge: challenge,
      expectedOrigin: expectedOrigins(),
      expectedRPID: rpId(),
    })
  } catch {
    return fail(400)
  }
  if (!verification.verified || !verification.registrationInfo) return fail(400)

  const { credential } = verification.registrationInfo
  const label = (body.device_label ?? "").trim().slice(0, 120) || null

  const supabase = createAdminClient()
  const { error } = await supabase.from("webauthn_credentials").insert({
    user_id: user.id,
    credential_id: credential.id,
    public_key: Buffer.from(credential.publicKey).toString("base64url"),
    counter: credential.counter,
    transports: credential.transports ?? [],
    device_label: label,
  })
  if (error) return fail(400)

  const res = NextResponse.json({ ok: true })
  res.cookies.set(CHALLENGE_COOKIE, "", clearedChallengeCookieOptions())
  return res
}
