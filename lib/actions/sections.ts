"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getUser } from "@/lib/supabase/auth"
import { SectionUpdateSchema, type SectionUpdateInput } from "@/lib/schemas"

export async function updateSection(id: string, input: SectionUpdateInput) {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  const parsed = SectionUpdateSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  try {
    const supabase = await createClient()
    const { error } = await supabase
      .from("sections")
      .update(parsed.data)
      .eq("id", id)
    if (error) throw error

    revalidatePath("/portfolio")
    revalidatePath("/admin/portfolio")
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update section"
    return { ok: false, error: message }
  }
}

export async function reorderSections(ids: string[]) {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  try {
    const supabase = await createClient()
    await Promise.all(
      ids.map((id, i) =>
        supabase.from("sections").update({ sort_order: i }).eq("id", id)
      )
    )
    revalidatePath("/portfolio")
    revalidatePath("/admin/portfolio")
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to reorder sections"
    return { ok: false, error: message }
  }
}
