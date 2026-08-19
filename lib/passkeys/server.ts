// Server-only WebAuthn/passkey helpers: RP-ID/origin resolution + the signed,
// single-use, short-TTL HttpOnly challenge cookie. Ported from the reference
// design in Bar Logic's app/core/passkeys.py — same shape (sign / read,
// purpose-bound, register additionally bound to the authenticated user id) —
// but signed with plain HMAC-SHA256 (node:crypto) instead of a JWT library,
// since SUPABASE_SECRET_KEY is already a server-only secret we can reuse as
// the signing key with no new dependency.
//
// No second DB table: the challenge only needs to survive the few seconds
// between /begin and /finish, so a cookie is simpler and self-expiring.
import { createHmac, timingSafeEqual } from "node:crypto"
import { SITE_URL } from "@/lib/site"

/** Name of the short-lived HttpOnly cookie carrying the signed challenge. */
export const CHALLENGE_COOKIE = "jk_wa_challenge"

/** Purposes a challenge can be bound to — a register challenge can never be
 *  redeemed by the auth/finish endpoint and vice-versa. */
export const PURPOSE_REGISTER = "register"
export const PURPOSE_AUTH = "auth"
export type ChallengePurpose = typeof PURPOSE_REGISTER | typeof PURPOSE_AUTH

export const CHALLENGE_TTL_SECONDS = 300

export function rpName(): string {
  return "Jamie Kendrioski"
}

/**
 * RP ID = the registrable domain, resolved from NEXT_PUBLIC_SITE_URL (falling
 * back to the live domain). A leading "www." is stripped so the same RP ID
 * covers both the apex and www hosts — WebAuthn credentials are scoped to the
 * RP ID, not a specific subdomain. On localhost this naturally resolves to
 * "localhost", which is the one host browsers exempt from HTTPS-only WebAuthn.
 */
export function rpId(): string {
  let host: string
  try {
    host = new URL(SITE_URL).hostname
  } catch {
    host = "www.jamiekendrioski.com"
  }
  return host.replace(/^www\./, "")
}

/**
 * Full page origins allowed to COMPLETE a ceremony. Localhost dev origin is
 * appended only outside production so local browser testing works without
 * weakening the production allow-list.
 */
export function expectedOrigins(): string[] {
  const origins = [SITE_URL]
  if (process.env.NODE_ENV !== "production" && !origins.includes("http://localhost:7847")) {
    origins.push("http://localhost:7847")
  }
  return origins
}

interface ChallengePayload {
  chal: string
  purpose: ChallengePurpose
  uid?: string
  exp: number // epoch seconds
}

function signingSecret(): string {
  const secret = process.env.SUPABASE_SECRET_KEY
  if (!secret) throw new Error("SUPABASE_SECRET_KEY is not set")
  return secret
}

function hmac(body: string): string {
  return createHmac("sha256", signingSecret()).update(body).digest("base64url")
}

/** Sign a challenge into the cookie value: base64url(payload).base64url(hmac). */
export function signChallengeCookie(
  challengeB64url: string,
  purpose: ChallengePurpose,
  userId?: string
): string {
  const payload: ChallengePayload = {
    chal: challengeB64url,
    purpose,
    exp: Math.floor(Date.now() / 1000) + CHALLENGE_TTL_SECONDS,
  }
  if (userId) payload.uid = userId
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")
  return `${body}.${hmac(body)}`
}

/**
 * Validate a signed challenge cookie and return the base64url challenge, or
 * null when the cookie is missing, tampered, expired, bound to a different
 * purpose, or — for register — bound to a different user than the current
 * session. Nothing here reveals which check failed (caller returns a single
 * generic error either way).
 */
export function readChallengeCookie(
  token: string | undefined | null,
  purpose: ChallengePurpose,
  userId?: string
): string | null {
  if (!token) return null
  const parts = token.split(".")
  if (parts.length !== 2) return null
  const [body, mac] = parts

  const expected = hmac(body)
  const macBuf = Buffer.from(mac)
  const expBuf = Buffer.from(expected)
  if (macBuf.length !== expBuf.length || !timingSafeEqual(macBuf, expBuf)) return null

  let payload: ChallengePayload
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"))
  } catch {
    return null
  }
  if (typeof payload.exp !== "number" || Math.floor(Date.now() / 1000) > payload.exp) return null
  if (payload.purpose !== purpose) return null
  if (userId !== undefined && payload.uid !== userId) return null
  return typeof payload.chal === "string" && payload.chal ? payload.chal : null
}

/** Cookie options shared by every route that sets the challenge cookie. */
export function challengeCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: CHALLENGE_TTL_SECONDS,
    path: "/",
  }
}

/** Options to clear the challenge cookie (single-use — cleared on every finish). */
export function clearedChallengeCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 0,
    path: "/",
  }
}
