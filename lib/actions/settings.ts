"use server"

import { revalidatePath } from "next/cache"
import { isAuthBypassed, getUser } from "@/lib/supabase/auth"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { SettingsSchema, type SettingsInput } from "@/lib/schemas"

async function db() {
  return isAuthBypassed() ? createAdminClient() : await createServerClient()
}

export async function updateSettings(input: SettingsInput) {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  const parsed = SettingsSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  try {
    const supabase = await db()
    const { data: existing } = await supabase.from("settings").select("id").single()

    if (existing) {
      const { error } = await supabase
        .from("settings")
        .update({ ...parsed.data, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
      if (error) throw error
    } else {
      const { error } = await supabase.from("settings").insert(parsed.data)
      if (error) throw error
    }

    revalidatePath("/admin/settings")
    revalidatePath("/")
    revalidatePath("/contact")
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update settings"
    return { ok: false, error: message }
  }
}
