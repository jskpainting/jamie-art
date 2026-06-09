import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import type { User } from "@supabase/supabase-js"

export async function getUser(): Promise<User | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

export async function requireUser(): Promise<User> {
  const user = await getUser()
  if (!user) redirect("/admin/login")
  return user
}
