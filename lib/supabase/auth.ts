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

export async function getUser(): Promise<User | null> {
  if (isAuthBypassed()) return DEV_USER
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

export async function requireUser(): Promise<User> {
  if (isAuthBypassed()) return DEV_USER
  const user = await getUser()
  if (!user) redirect("/admin/login")
  return user
}
