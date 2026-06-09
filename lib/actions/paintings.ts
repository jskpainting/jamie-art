"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getUser } from "@/lib/supabase/auth"
import {
  PaintingWriteSchema,
  PaintingImageSchema,
  type PaintingImageInput,
} from "@/lib/schemas"

async function getSectionSlug(sectionId: string): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("sections")
    .select("slug")
    .eq("id", sectionId)
    .single()
  return data?.slug ?? null
}

function revalidateSectionPaths(sectionSlug: string | null) {
  revalidatePath("/portfolio")
  revalidatePath("/admin/portfolio")
  if (sectionSlug) {
    revalidatePath(`/portfolio/${sectionSlug}`)
    revalidatePath(`/admin/portfolio/${sectionSlug}`)
  }
}

export async function createPainting(input: unknown) {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  const parsed = PaintingWriteSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  try {
    const supabase = await createClient()
    const { price_dollars: price_cents, ...rest } = parsed.data
    const { data, error } = await supabase
      .from("paintings")
      .insert({ ...rest, price_cents })
      .select("id")
      .single()
    if (error) throw error

    const slug = await getSectionSlug(parsed.data.section_id)
    revalidateSectionPaths(slug)
    return { ok: true, data: { id: data.id } }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create painting"
    return { ok: false, error: message }
  }
}

export async function updatePainting(id: string, input: unknown) {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  const parsed = PaintingWriteSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  try {
    const supabase = await createClient()
    const { price_dollars: price_cents, ...rest } = parsed.data
    const { error } = await supabase
      .from("paintings")
      .update({ ...rest, price_cents })
      .eq("id", id)
    if (error) throw error

    const slug = await getSectionSlug(parsed.data.section_id)
    revalidateSectionPaths(slug)
    // Also revalidate painting detail page
    const { data: painting } = await supabase
      .from("paintings")
      .select("slug")
      .eq("id", id)
      .single()
    if (painting && slug) {
      revalidatePath(`/portfolio/${slug}/${painting.slug}`)
    }
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update painting"
    return { ok: false, error: message }
  }
}

export async function deletePainting(id: string) {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  try {
    const supabase = await createClient()
    const { data: painting } = await supabase
      .from("paintings")
      .select("section_id, slug")
      .eq("id", id)
      .single()

    const { error } = await supabase.from("paintings").delete().eq("id", id)
    if (error) throw error

    if (painting) {
      const slug = await getSectionSlug(painting.section_id)
      revalidateSectionPaths(slug)
      if (slug) revalidatePath(`/portfolio/${slug}/${painting.slug}`)
    }
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete painting"
    return { ok: false, error: message }
  }
}

export async function reorderPaintings(sectionId: string, ids: string[]) {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  try {
    const supabase = await createClient()
    await Promise.all(
      ids.map((id, i) =>
        supabase.from("paintings").update({ sort_order: i }).eq("id", id)
      )
    )
    const slug = await getSectionSlug(sectionId)
    revalidateSectionPaths(slug)
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to reorder paintings"
    return { ok: false, error: message }
  }
}

export async function addPaintingImage(
  paintingId: string,
  input: PaintingImageInput
) {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  const parsed = PaintingImageSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  try {
    const supabase = await createClient()
    const { count } = await supabase
      .from("painting_images")
      .select("*", { count: "exact", head: true })
      .eq("painting_id", paintingId)

    const { data, error } = await supabase
      .from("painting_images")
      .insert({ painting_id: paintingId, ...parsed.data, sort_order: count ?? 0 })
      .select("id")
      .single()
    if (error) throw error
    return { ok: true, data: { id: data.id } }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to add image"
    return { ok: false, error: message }
  }
}

export async function deletePaintingImage(id: string) {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  try {
    const supabase = await createClient()
    const { error } = await supabase
      .from("painting_images")
      .delete()
      .eq("id", id)
    if (error) throw error
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete image"
    return { ok: false, error: message }
  }
}

export async function reorderPaintingImages(
  paintingId: string,
  ids: string[]
) {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  try {
    const supabase = await createClient()
    await Promise.all(
      ids.map((id, i) =>
        supabase
          .from("painting_images")
          .update({ sort_order: i })
          .eq("id", id)
          .eq("painting_id", paintingId)
      )
    )
    return { ok: true }
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to reorder images"
    return { ok: false, error: message }
  }
}
