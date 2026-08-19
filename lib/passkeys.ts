// passkeys.ts — client helpers for passkey (WebAuthn) sign-in & registration.
// Ported from the Bar Logic reference client (web-v2/lib/passkeys.ts): native
// browser WebAuthn (navigator.credentials), zero dependencies, base64url
// helpers included. Adapted to this app's same-origin Next.js route handlers:
//
//   POST /api/auth/passkey/register/begin   → PublicKeyCredentialCreationOptions (JSON)
//   POST /api/auth/passkey/register/finish  { credential, device_label }
//   POST /api/auth/passkey/auth/begin       → PublicKeyCredentialRequestOptions (JSON)
//   POST /api/auth/passkey/auth/finish      { credential }  → { ok: true } (sets session cookie)
//   GET  /api/auth/passkeys                  → { passkeys: [...] }
//   DELETE /api/auth/passkeys/{id}
//
// Same-origin fetch — no credentials:'include' needed, but it's harmless so
// it's kept for parity with the reference. Passkeys are ADDITIVE: every
// failure path here returns cleanly (false / null / []) so the caller can
// fall back to password or magic-link sign-in.
"use client"

import { useSyncExternalStore } from "react"

// ── base64url <-> ArrayBuffer ────────────────────────────────────────────────
function base64urlToBuffer(value: string): ArrayBuffer {
  const pad = "=".repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + pad).replace(/-/g, "+").replace(/_/g, "/")
  const bin = atob(base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes.buffer
}

function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let bin = ""
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

// ── support detection ────────────────────────────────────────────────────────
export function browserSupportsPasskeys(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential !== "undefined" &&
    !!navigator.credentials
  )
}

const noopSubscribe = () => () => {}

/**
 * React hook wrapper around `browserSupportsPasskeys()` for feature-detecting
 * on mount without an SSR/hydration mismatch. Uses `useSyncExternalStore`
 * (not `useState` + `useEffect`) so there's no synchronous setState-in-effect:
 * the server snapshot is always `false` (no WebAuthn in SSR), and the client
 * snapshot flips to the real value on hydration.
 */
export function useBrowserSupportsPasskeys(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => browserSupportsPasskeys(),
    () => false
  )
}

/** True if a built-in platform authenticator (Face/Touch ID, Windows Hello) is
 *  available — used only to tailor copy, never to gate the flow. */
export async function platformAuthenticatorAvailable(): Promise<boolean> {
  try {
    if (!browserSupportsPasskeys()) return false
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

// ── option shape (subset we consume; extra fields pass through untouched) ─────
interface CredDescriptorJSON {
  id: string
  type: string
  transports?: string[]
}
interface RegOptionsJSON {
  challenge: string
  rp: PublicKeyCredentialRpEntity
  user: { id: string; name: string; displayName: string }
  pubKeyCredParams: PublicKeyCredentialParameters[]
  timeout?: number
  attestation?: AttestationConveyancePreference
  authenticatorSelection?: AuthenticatorSelectionCriteria
  excludeCredentials?: CredDescriptorJSON[]
}
interface AuthOptionsJSON {
  challenge: string
  timeout?: number
  rpId?: string
  userVerification?: UserVerificationRequirement
  allowCredentials?: CredDescriptorJSON[]
}

function toDescriptors(list?: CredDescriptorJSON[]): PublicKeyCredentialDescriptor[] | undefined {
  if (!list || list.length === 0) return undefined
  return list.map((c) => ({
    id: base64urlToBuffer(c.id),
    type: "public-key" as const,
    transports: c.transports as AuthenticatorTransport[] | undefined,
  }))
}

/**
 * Register a new passkey on the current (already signed-in) account.
 * Returns true on success. `deviceLabel` is an optional user-facing nickname.
 * Throws on a genuine ceremony error the caller wants to surface as a toast; a
 * user cancellation (NotAllowedError) is also thrown so the caller can tell
 * cancel apart from failure and reset quietly instead of showing an error.
 */
export async function registerPasskey(deviceLabel?: string): Promise<boolean> {
  const beginRes = await fetch("/api/auth/passkey/register/begin", {
    method: "POST",
    credentials: "include",
  })
  if (!beginRes.ok) throw new Error("Could not start passkey registration.")
  const options: RegOptionsJSON = await beginRes.json()

  const publicKey: PublicKeyCredentialCreationOptions = {
    ...options,
    challenge: base64urlToBuffer(options.challenge),
    user: {
      ...options.user,
      id: base64urlToBuffer(options.user.id),
    },
    excludeCredentials: toDescriptors(options.excludeCredentials),
  }

  const credential = (await navigator.credentials.create({
    publicKey,
  })) as PublicKeyCredential | null
  if (!credential) throw new Error("No passkey was created.")

  const response = credential.response as AuthenticatorAttestationResponse
  const transports =
    typeof response.getTransports === "function" ? response.getTransports() : []

  const finishRes = await fetch("/api/auth/passkey/register/finish", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      credential: {
        id: credential.id,
        rawId: bufferToBase64url(credential.rawId),
        type: credential.type,
        response: {
          clientDataJSON: bufferToBase64url(response.clientDataJSON),
          attestationObject: bufferToBase64url(response.attestationObject),
          transports,
        },
        clientExtensionResults: credential.getClientExtensionResults?.() ?? {},
      },
      device_label: deviceLabel || undefined,
    }),
  })
  if (!finishRes.ok) throw new Error("Passkey registration could not be verified.")
  return true
}

/**
 * Passwordless sign-in with a passkey. On success the backend sets the
 * session cookie. Returns true on success, or null on any failure (including
 * user cancel) so the caller can fall back to password / magic-link silently.
 */
export async function authenticateWithPasskey(): Promise<boolean | null> {
  const beginRes = await fetch("/api/auth/passkey/auth/begin", {
    method: "POST",
    credentials: "include",
  })
  if (!beginRes.ok) return null
  const options: AuthOptionsJSON = await beginRes.json()

  const publicKey: PublicKeyCredentialRequestOptions = {
    ...options,
    challenge: base64urlToBuffer(options.challenge),
    allowCredentials: toDescriptors(options.allowCredentials),
  }

  let credential: PublicKeyCredential | null
  try {
    credential = (await navigator.credentials.get({
      publicKey,
    })) as PublicKeyCredential | null
  } catch {
    // User cancelled or no matching passkey — quiet fallback to other methods.
    return null
  }
  if (!credential) return null

  const response = credential.response as AuthenticatorAssertionResponse
  const finishRes = await fetch("/api/auth/passkey/auth/finish", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      credential: {
        id: credential.id,
        rawId: bufferToBase64url(credential.rawId),
        type: credential.type,
        response: {
          clientDataJSON: bufferToBase64url(response.clientDataJSON),
          authenticatorData: bufferToBase64url(response.authenticatorData),
          signature: bufferToBase64url(response.signature),
          userHandle: response.userHandle
            ? bufferToBase64url(response.userHandle)
            : undefined,
        },
        clientExtensionResults: credential.getClientExtensionResults?.() ?? {},
      },
    }),
  })
  if (!finishRes.ok) return null
  return true
}

// ── manage ───────────────────────────────────────────────────────────────────
export interface PasskeyRow {
  id: string
  device_label: string | null
  created_at: string | null
  last_used_at: string | null
}

export async function listPasskeys(): Promise<PasskeyRow[]> {
  try {
    const res = await fetch("/api/auth/passkeys", { credentials: "include" })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data?.passkeys) ? data.passkeys : []
  } catch {
    return []
  }
}

export async function deletePasskey(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/auth/passkeys/${id}`, {
      method: "DELETE",
      credentials: "include",
    })
    return res.ok
  } catch {
    return false
  }
}
