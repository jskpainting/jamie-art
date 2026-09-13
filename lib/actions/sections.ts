"use server"

import { revalidatePath } from "next/cache"
import { isAuthBypassed, getUser } from "@/lib/supabase/auth"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  SectionWriteSchema,
  type SectionWriteInput,
} from "@/lib/schemas"
import { isSchemaSetupError } from "@/lib/schema-capabilities"

async function db() {
  return isAuthBypassed() ? createAdminClient() : await createServerClient()
}

function revalidate() {
  revalidatePath("/portfolio")
  revalidatePath("/admin/portfolio")
}

export async function createSection(input: SectionWriteInput) {
  const user = await getUser()
  if (!user) return { ok: false as const, error: "Unauthorized" }

  const parsed = SectionWriteSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0].message }
  }

  try {
    const supabase = await db()
    const payload: Record<string, unknown> = {
      title: parsed.data.title,
      slug: parsed.data.slug,
      description: parsed.data.description ?? null,
      cover_image_url: parsed.data.cover_image_url ?? null,
      sort_order: 0,
    }
    if (parsed.data.cover_focal_x !== undefined) payload.cover_focal_x = parsed.data.cover_focal_x
    if (parsed.data.cover_focal_y !== undefined) payload.cover_focal_y = parsed.data.cover_focal_y

    let { error } = await supabase.from("sections").insert(payload)
    if (error && isSchemaSetupError(error)) {
      const { cover_focal_x: _fx, cover_focal_y: _fy, ...withoutFocal } = payload
      void _fx
      void _fy
      ;({ error } = await supabase.from("sections").insert(withoutFocal))
    }
    if (error) {
      if (error.code === "23505") {
        return { ok: false as const, error: "Slug already in use — choose a different slug" }
      }
      throw error
    }
    revalidate()
    return { ok: true as const }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create section"
    return { ok: false as const, error: message }
  }
}

export async function updateSection(id: string, input: SectionWriteInput) {
  const user = await getUser()
  if (!user) return { ok: false as const, error: "Unauthorized" }

  const parsed = SectionWriteSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0].message }
  }

  try {
    const supabase = await db()

    // Fetch current section so we know the old slug (needed to revalidate
    // both old and new paths if the slug changes).
    const { data: current, error: fetchError } = await supabase
      .from("sections")
      .select("slug")
      .eq("id", id)
      .single()
    if (fetchError || !current) return { ok: false as const, error: "Section not found" }

    const payload: Record<string, unknown> = {
      title: parsed.data.title,
      slug: parsed.data.slug,
      description: parsed.data.description ?? null,
      cover_image_url: parsed.data.cover_image_url ?? null,
    }
    if (parsed.data.cover_focal_x !== undefined) payload.cover_focal_x = parsed.data.cover_focal_x
    if (parsed.data.cover_focal_y !== undefined) payload.cover_focal_y = parsed.data.cover_focal_y

    let { error } = await supabase.from("sections").update(payload).eq("id", id)
    if (error && isSchemaSetupError(error)) {
      const { cover_focal_x: _fx, cover_focal_y: _fy, ...withoutFocal } = payload
      void _fx
      void _fy
      ;({ error } = await supabase.from("sections").update(withoutFocal).eq("id", id))
    }
    if (error) {
      if (error.code === "23505") {
        return { ok: false as const, error: "Slug already in use — choose a different slug" }
      }
      throw error
    }

    revalidate()
    if (current.slug !== parsed.data.slug) {
      revalidatePath(`/portfolio/${current.slug}`)
      revalidatePath(`/admin/portfolio/${current.slug}`)
      revalidatePath(`/portfolio/${parsed.data.slug}`)
      revalidatePath(`/admin/portfolio/${parsed.data.slug}`)
      revalidatePath("/sitemap.xml")
      revalidatePath("/admin")
    }
    return { ok: true as const }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update section"
    return { ok: false as const, error: message }
  }
}

export async function deleteSection(
  id: string
): Promise<{ ok: boolean; movedCount?: number; error?: string }> {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  try {
    const supabase = await db()

    // `delete_section_safe` moves the deleted section's paintings into the
    // `uncategorized` holding bucket and raises if that slug doesn't exist.
    // Since the slug is now editable (owners can rename it into a real,
    // public gallery — e.g. "archives"), the bucket may no longer be there
    // by the time a different section gets deleted. Re-create it on demand
    // so the RPC always has somewhere to put orphaned paintings. If the
    // section being deleted IS the current `uncategorized` slug, leave this
    // alone and let the RPC's own "can't delete uncategorized" error surface
    // as before.
    const { data: existing, error: existingError } = await supabase
      .from("sections")
      .select("id")
      .eq("slug", "uncategorized")
      .maybeSingle()
    if (existingError) throw existingError
    if (!existing) {
      const { error: insertError } = await supabase.from("sections").insert({
        slug: "uncategorized",
        title: "Uncategorized",
        sort_order: 999,
      })
      if (insertError) return { ok: false, error: insertError.message }
    }

    const { data, error } = await supabase.rpc("delete_section_safe", {
      p_section_id: id,
    })
    if (error) throw error
    revalidate()
    return { ok: true, movedCount: data as number }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete section"
    return { ok: false, error: message }
  }
}

export async function reorderSections(ids: string[]) {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  try {
    const supabase = await db()
    // Promise.all never rejects here: supabase-js resolves with { error }
    // instead of throwing, so every one of these writes could fail and the
    // owner would still be told "Order saved".
    const results = await Promise.all(
      ids.map((id, i) =>
        supabase.from("sections").update({ sort_order: i }).eq("id", id)
      )
    )
    const failed = results.find((r) => r.error)
    if (failed?.error) throw failed.error
    revalidate()
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to reorder sections"
    return { ok: false, error: message }
  }
}
