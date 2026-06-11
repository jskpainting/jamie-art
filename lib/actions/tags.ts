"use server"

import { revalidatePath } from "next/cache"
import { getUser, isAuthBypassed } from "@/lib/supabase/auth"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { TagNamesSchema } from "@/lib/schemas"

async function db() {
  return isAuthBypassed() ? createAdminClient() : await createServerClient()
}

export async function updatePaintingTags(
  paintingId: string,
  tagNames: string[]
): Promise<{ ok: boolean; error?: string }> {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  const parsed = TagNamesSchema.safeParse(tagNames)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  const normalised = parsed.data // already trimmed + lowercased by schema

  try {
    const supabase = await db()

    // Upsert each tag name, get IDs back
    const tagIds: string[] = []
    for (const name of normalised) {
      const { data, error } = await supabase
        .from("tags")
        .upsert({ name }, { onConflict: "name" })
        .select("id")
        .single()
      if (error) throw error
      tagIds.push(data.id as string)
    }

    // Fetch existing painting_tags for this painting
    const { data: existing, error: fetchError } = await supabase
      .from("painting_tags")
      .select("tag_id")
      .eq("painting_id", paintingId)
    if (fetchError) throw fetchError

    const existingIds = new Set((existing ?? []).map((r) => r.tag_id as string))
    const desiredIds = new Set(tagIds)

    // Delete removed
    const toDelete = [...existingIds].filter((id) => !desiredIds.has(id))
    if (toDelete.length > 0) {
      const { error: delError } = await supabase
        .from("painting_tags")
        .delete()
        .eq("painting_id", paintingId)
        .in("tag_id", toDelete)
      if (delError) throw delError
    }

    // Insert new
    const toInsert = tagIds.filter((id) => !existingIds.has(id))
    if (toInsert.length > 0) {
      const { error: insError } = await supabase
        .from("painting_tags")
        .insert(toInsert.map((tag_id) => ({ painting_id: paintingId, tag_id })))
      if (insError) throw insError
    }

    // Revalidate detail page (we don't know the slugs here, revalidate broadly)
    revalidatePath("/portfolio", "layout")

    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update tags"
    return { ok: false, error: message }
  }
}
