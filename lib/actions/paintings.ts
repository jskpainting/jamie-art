"use server"

import { revalidatePath } from "next/cache"
import { isAuthBypassed, getUser } from "@/lib/supabase/auth"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  PaintingWriteSchema,
  PaintingImageSchema,
  type PaintingImageInput,
} from "@/lib/schemas"
import { slugify } from "@/lib/utils"
import type { PaintingStatus } from "@/lib/types"

export interface BulkCreateItem {
  title: string
  section_id: string
  primary_image_url: string | null
  status: "available" | "sold" | "nfs" | "reserved"
  year?: string
  medium?: string
  dimensions?: string
  price_dollars?: string
  story?: string
  print_available: boolean
  commission_available: boolean
  tags: string[]
}

async function db() {
  return isAuthBypassed() ? createAdminClient() : await createServerClient()
}

async function getSectionSlug(sectionId: string): Promise<string | null> {
  const supabase = await db()
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
    const supabase = await db()
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
    const supabase = await db()
    const { price_dollars: price_cents, ...rest } = parsed.data
    const { error } = await supabase
      .from("paintings")
      .update({ ...rest, price_cents })
      .eq("id", id)
    if (error) throw error

    const slug = await getSectionSlug(parsed.data.section_id)
    revalidateSectionPaths(slug)
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
    const supabase = await db()
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
    const supabase = await db()
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
    const supabase = await db()
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
    const supabase = await db()
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
    const supabase = await db()
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

export async function bulkUpdateStatus(
  ids: string[],
  status: PaintingStatus
): Promise<{ ok: boolean; error?: string; count?: number }> {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }
  if (ids.length === 0) return { ok: true, count: 0 }

  try {
    const supabase = await db()
    await Promise.all(
      ids.map((id) => supabase.from("paintings").update({ status }).eq("id", id).then())
    )
    revalidatePath("/portfolio")
    revalidatePath("/admin/portfolio")
    return { ok: true, count: ids.length }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update status" }
  }
}

export async function bulkUpdateSection(
  ids: string[],
  sectionId: string
): Promise<{ ok: boolean; error?: string; count?: number }> {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }
  if (ids.length === 0) return { ok: true, count: 0 }

  try {
    const supabase = await db()
    await Promise.all(
      ids.map((id) =>
        supabase.from("paintings").update({ section_id: sectionId }).eq("id", id).then()
      )
    )
    revalidatePath("/portfolio")
    revalidatePath("/admin/portfolio")
    return { ok: true, count: ids.length }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update section" }
  }
}

export async function bulkAddTag(
  ids: string[],
  tagName: string
): Promise<{ ok: boolean; error?: string; count?: number }> {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }
  if (ids.length === 0 || !tagName.trim()) return { ok: true, count: 0 }

  try {
    const supabase = await db()
    const name = tagName.trim().toLowerCase()
    // Upsert the tag
    const { data: tagRow, error: tagErr } = await supabase
      .from("tags")
      .upsert({ name }, { onConflict: "name" })
      .select("id")
      .single()
    if (tagErr) throw tagErr

    // Link to each painting (ignore conflicts)
    await supabase
      .from("painting_tags")
      .upsert(
        ids.map((painting_id) => ({ painting_id, tag_id: tagRow.id })),
        { onConflict: "painting_id,tag_id" }
      )
    return { ok: true, count: ids.length }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to add tag" }
  }
}

export async function bulkRemoveTag(
  ids: string[],
  tagName: string
): Promise<{ ok: boolean; error?: string; count?: number }> {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }
  if (ids.length === 0 || !tagName.trim()) return { ok: true, count: 0 }

  try {
    const supabase = await db()
    const name = tagName.trim().toLowerCase()
    const { data: tagRow } = await supabase
      .from("tags")
      .select("id")
      .eq("name", name)
      .single()
    if (!tagRow) return { ok: true, count: 0 }

    await supabase
      .from("painting_tags")
      .delete()
      .eq("tag_id", tagRow.id)
      .in("painting_id", ids)
    return { ok: true, count: ids.length }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to remove tag" }
  }
}

export async function bulkDelete(
  ids: string[]
): Promise<{ ok: boolean; error?: string; count?: number }> {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }
  if (ids.length === 0) return { ok: true, count: 0 }

  try {
    const supabase = await db()
    const { error } = await supabase.from("paintings").delete().in("id", ids)
    if (error) throw error
    revalidatePath("/portfolio")
    revalidatePath("/admin/portfolio")
    return { ok: true, count: ids.length }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to delete paintings" }
  }
}

export async function bulkCreatePaintings(
  items: BulkCreateItem[]
): Promise<{ ok: boolean; error?: string; count?: number; sectionSlug?: string }> {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }
  if (items.length === 0) return { ok: true, count: 0 }

  try {
    const supabase = await db()
    const sectionIds = [...new Set(items.map((i) => i.section_id))]

    // Max sort_order + existing slugs per section
    const sortOffsets = new Map<string, number>()
    const existingSlugs = new Map<string, Set<string>>()

    for (const sectionId of sectionIds) {
      const { data: maxRow } = await supabase
        .from("paintings")
        .select("sort_order")
        .eq("section_id", sectionId)
        .order("sort_order", { ascending: false })
        .limit(1)
      sortOffsets.set(sectionId, (maxRow?.[0]?.sort_order ?? -1) + 1)

      const { data: slugRows } = await supabase
        .from("paintings")
        .select("slug")
        .eq("section_id", sectionId)
      existingSlugs.set(sectionId, new Set((slugRows ?? []).map((r) => r.slug as string)))
    }

    // Track used slugs per section within this batch (seeded with DB slugs)
    const usedSlugs = new Map<string, Set<string>>(
      sectionIds.map((id) => [id, new Set(existingSlugs.get(id) ?? [])])
    )
    const sectionCounters = new Map<string, number>(sectionIds.map((id) => [id, 0]))

    let savedCount = 0

    for (const item of items) {
      // Derive unique slug within section
      const base = slugify(item.title) || "painting"
      let slug = base
      const used = usedSlugs.get(item.section_id)!
      if (used.has(slug)) {
        let n = 2
        while (used.has(`${base}-${n}`)) n++
        slug = `${base}-${n}`
      }
      used.add(slug)

      const counter = sectionCounters.get(item.section_id) ?? 0
      sectionCounters.set(item.section_id, counter + 1)
      const sort_order = (sortOffsets.get(item.section_id) ?? 0) + counter

      const parsed = PaintingWriteSchema.safeParse({ ...item, slug })
      if (!parsed.success) continue

      const { price_dollars: price_cents, ...rest } = parsed.data
      const { data, error } = await supabase
        .from("paintings")
        .insert({ ...rest, price_cents, sort_order })
        .select("id")
        .single()

      if (error || !data) continue
      savedCount++

      // Insert tags
      for (const name of item.tags) {
        const normalized = name.trim().toLowerCase()
        if (!normalized) continue
        const { data: tagRow } = await supabase
          .from("tags")
          .upsert({ name: normalized }, { onConflict: "name" })
          .select("id")
          .single()
        if (tagRow) {
          await supabase
            .from("painting_tags")
            .upsert(
              { painting_id: data.id, tag_id: tagRow.id as string },
              { onConflict: "painting_id,tag_id" }
            )
        }
      }
    }

    for (const sectionId of sectionIds) {
      const slug = await getSectionSlug(sectionId)
      revalidateSectionPaths(slug)
    }

    const primarySlug = await getSectionSlug(items[0].section_id)
    return { ok: true, count: savedCount, sectionSlug: primarySlug ?? undefined }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to create paintings",
    }
  }
}
