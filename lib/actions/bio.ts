"use server"

import { revalidatePath } from "next/cache"
import { isAuthBypassed, getUser } from "@/lib/supabase/auth"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { BioSchema, type BioInput } from "@/lib/schemas"
import { isSchemaSetupError, SCHEMA_SETUP_MESSAGE } from "@/lib/schema-capabilities"

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

  // headshot_focal_x/y aren't migrated on every environment yet — drop them and
  // retry once if the column is missing, rather than failing the whole save.
  const { headshot_focal_x: _fx, headshot_focal_y: _fy, ...withoutFocal } = parsed.data
  void _fx
  void _fy

  try {
    const supabase = await db()
    const { data: existing } = await supabase.from("bio").select("id").single()

    if (existing) {
      let { error } = await supabase
        .from("bio")
        .update({ ...parsed.data, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
      if (error && isSchemaSetupError(error)) {
        ;({ error } = await supabase
          .from("bio")
          .update({ ...withoutFocal, updated_at: new Date().toISOString() })
          .eq("id", existing.id))
      }
      if (error) throw error
    } else {
      let { error } = await supabase.from("bio").insert(parsed.data)
      if (error && isSchemaSetupError(error)) {
        ;({ error } = await supabase.from("bio").insert(withoutFocal))
      }
      if (error) throw error
    }

    revalidatePath("/about")
    revalidatePath("/admin/bio")
    return { ok: true }
  } catch (e) {
    if (isSchemaSetupError(e)) return { ok: false, error: SCHEMA_SETUP_MESSAGE }
    const message = e instanceof Error ? e.message : "Failed to update bio"
    return { ok: false, error: message }
  }
}
