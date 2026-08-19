import { NextResponse } from "next/server"
import { generateAuthenticationOptions } from "@simplewebauthn/server"
import {
  CHALLENGE_COOKIE,
  PURPOSE_AUTH,
  challengeCookieOptions,
  rpId,
  signChallengeCookie,
} from "@/lib/passkeys/server"

// Public, usernameless: no email is accepted and no allowCredentials list is
// returned, so this endpoint can never reveal whether a given account has a
// passkey registered (security requirement #5 — no user enumeration). The
// browser resolves which of the device's resident/discoverable credentials
// applies to this RP ID on its own.
export async function POST() {
  const options = await generateAuthenticationOptions({
    rpID: rpId(),
    userVerification: "preferred",
  })

  const token = signChallengeCookie(options.challenge, PURPOSE_AUTH)
  const res = NextResponse.json(options)
  res.cookies.set(CHALLENGE_COOKIE, token, challengeCookieOptions())
  return res
}
