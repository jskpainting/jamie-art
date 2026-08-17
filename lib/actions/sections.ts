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

    // Fetch current section to enforce slug lock on uncategorized
    const { data: current, error: fetchError } = await supabase
      .from("sections")
      .select("slug")
      .eq("id", id)
      .single()
    if (fetchError || !current) return { ok: false as const, error: "Section not found" }

    if (current.slug === "uncategorized" && parsed.data.slug !== "uncategorized") {
      return { ok: false as const, error: "The Uncategorized section slug cannot be changed" }
    }

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
    await Promise.all(
      ids.map((id, i) =>
        supabase.from("sections").update({ sort_order: i }).eq("id", id)
      )
    )
    revalidate()
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to reorder sections"
    return { ok: false, error: message }
  }
}
