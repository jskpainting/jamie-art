import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import type { User } from "@supabase/supabase-js"

export function isAuthBypassed(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.ADMIN_AUTH_BYPASS === "true"
  )
}

if (isAuthBypassed()) {
  console.warn(
    "⚠️  ADMIN_AUTH_BYPASS active — admin auth is OFF (dev only)"
  )
}

const DEV_USER = {
  id: "00000000-0000-0000-0000-000000000000",
  email: "dev@local",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: {},
  user_metadata: {},
  created_at: new Date().toISOString(),
} as unknown as User

/** Comma-separated allowlist of admin emails from env (`ADMIN_EMAILS`), normalised. */
export function adminEmailAllowlist(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

/**
 * True only if `email` is on the ADMIN_EMAILS allowlist.
 * Fails closed: an empty/unset allowlist means nobody is an admin.
 */
export function isAllowedAdmin(email: string | null | undefined): boolean {
  if (!email) return false
  return adminEmailAllowlist().includes(email.toLowerCase())
}

export async function getUser(): Promise<User | null> {
  if (isAuthBypassed()) return DEV_USER
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  // Hard gate: a valid Supabase session is NOT enough. The signed-in email
  // must be on the ADMIN_EMAILS allowlist, otherwise treat as signed-out.
  if (!isAllowedAdmin(user.email)) return null
  return user
}

export async function requireUser(): Promise<User> {
  if (isAuthBypassed()) return DEV_USER
  const user = await getUser()
  if (!user) redirect("/admin/login")
  return user
}
