"use server"

import { revalidatePath } from "next/cache"
import { getUser, isAuthBypassed } from "@/lib/supabase/auth"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { TagNameSchema, TagNamesSchema } from "@/lib/schemas"

async function db() {
  return isAuthBypassed() ? createAdminClient() : await createServerClient()
}

function revalidate() {
  revalidatePath("/admin/settings")
  revalidatePath("/portfolio", "layout")
  revalidatePath("/admin/portfolio", "layout")
}

export interface TagWithUsage {
  id: string
  name: string
  inUse: number
}

/** Every tag with how many paintings currently use it, sorted by name. */
export async function getAllTags(): Promise<
  { ok: true; tags: TagWithUsage[] } | { ok: false; error: string }
> {
  try {
    const supabase = await db()

    const { data: tags, error: tagsError } = await supabase
      .from("tags")
      .select("id, name")
      .order("name", { ascending: true })
    if (tagsError) throw tagsError

    const { data: links, error: linksError } = await supabase
      .from("painting_tags")
      .select("tag_id")
    if (linksError) throw linksError

    const counts = new Map<string, number>()
    for (const row of links ?? []) {
      const tagId = row.tag_id as string
      counts.set(tagId, (counts.get(tagId) ?? 0) + 1)
    }

    const rows: TagWithUsage[] = (tags ?? []).map((t) => ({
      id: t.id as string,
      name: t.name as string,
      inUse: counts.get(t.id as string) ?? 0,
    }))

    return { ok: true, tags: rows }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load tags"
    return { ok: false, error: message }
  }
}

export async function createTag(
  name: string
): Promise<{ ok: boolean; error?: string; tag?: { id: string; name: string } }> {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  const parsed = TagNameSchema.safeParse(name)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  try {
    const supabase = await db()
    const { data, error } = await supabase
      .from("tags")
      .upsert({ name: parsed.data }, { onConflict: "name" })
      .select("id, name")
      .single()
    if (error) throw error

    revalidate()
    return { ok: true, tag: { id: data.id as string, name: data.name as string } }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create tag"
    return { ok: false, error: message }
  }
}

export async function renameTag(
  id: string,
  name: string
): Promise<{ ok: boolean; error?: string }> {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  const parsed = TagNameSchema.safeParse(name)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  try {
    const supabase = await db()
    const { error } = await supabase
      .from("tags")
      .update({ name: parsed.data })
      .eq("id", id)
    if (error) {
      if ((error as { code?: string }).code === "23505") {
        return { ok: false, error: "That tag already exists" }
      }
      throw error
    }

    revalidate()
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to rename tag"
    return { ok: false, error: message }
  }
}

export async function deleteTag(id: string): Promise<{ ok: boolean; error?: string }> {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  try {
    const supabase = await db()
    // painting_tags has ON DELETE CASCADE on tag_id, so removing the tag
    // also removes it from every painting that had it.
    const { error } = await supabase.from("tags").delete().eq("id", id)
    if (error) throw error

    revalidate()
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete tag"
    return { ok: false, error: message }
  }
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
