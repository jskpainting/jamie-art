"use server"

import { revalidatePath } from "next/cache"
import { isAuthBypassed, getUser } from "@/lib/supabase/auth"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { BioSchema, type BioInput } from "@/lib/schemas"

async function db() {
  return isAuthBypassed() ? createAdminClient() : await createServerClient()
}

export async function updateBio(input: BioInput) {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  const parsed = BioSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  try {
    const supabase = await db()
    const { data: existing } = await supabase.from("bio").select("id").single()

    if (existing) {
      const { error } = await supabase
        .from("bio")
        .update({ ...parsed.data, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
      if (error) throw error
    } else {
      const { error } = await supabase.from("bio").insert(parsed.data)
      if (error) throw error
    }

    revalidatePath("/about")
    revalidatePath("/admin/bio")
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update bio"
    return { ok: false, error: message }
  }
}
