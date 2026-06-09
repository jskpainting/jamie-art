import { createClient } from "@/lib/supabase/server"
import type {
  Bio,
  Event,
  Painting,
  PaintingWithImages,
  Section,
  SectionWithCount,
} from "@/lib/types"

export async function getSections(): Promise<SectionWithCount[]> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("sections")
      .select("*, paintings(count)")
      .order("sort_order")
    if (error) throw error
    return (data ?? []).map((s) => ({
      ...s,
      painting_count:
        (s.paintings as unknown as { count: number }[])[0]?.count ?? 0,
    }))
  } catch (err) {
    console.error("getSections error:", err)
    return []
  }
}

export async function getSectionBySlug(slug: string): Promise<Section | null> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("sections")
      .select("*")
      .eq("slug", slug)
      .single()
    if (error) throw error
    return data
  } catch (err) {
    console.error("getSectionBySlug error:", err)
    return null
  }
}

export async function getPaintingsBySection(
  sectionId: string
): Promise<Painting[]> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("paintings")
      .select("*")
      .eq("section_id", sectionId)
      .order("sort_order")
    if (error) throw error
    return data ?? []
  } catch (err) {
    console.error("getPaintingsBySection error:", err)
    return []
  }
}

export async function getPaintingBySlug(
  sectionSlug: string,
  paintingSlug: string
): Promise<PaintingWithImages | null> {
  try {
    const supabase = await createClient()

    // First resolve the section id from slug
    const { data: sectionData, error: sectionError } = await supabase
      .from("sections")
      .select("id")
      .eq("slug", sectionSlug)
      .single()
    if (sectionError || !sectionData) return null

    const { data, error } = await supabase
      .from("paintings")
      .select("*, painting_images(id, url, alt, sort_order)")
      .eq("section_id", sectionData.id)
      .eq("slug", paintingSlug)
      .single()
    if (error) throw error

    // Sort painting_images by sort_order client-side
    const result = data as unknown as PaintingWithImages
    result.painting_images = (result.painting_images ?? []).sort(
      (a, b) => a.sort_order - b.sort_order
    )
    return result
  } catch (err) {
    console.error("getPaintingBySlug error:", err)
    return null
  }
}

export async function getFeaturedPaintings(limit = 6): Promise<Painting[]> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("paintings")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit)
    if (error) throw error
    return data ?? []
  } catch (err) {
    console.error("getFeaturedPaintings error:", err)
    return []
  }
}

export async function getRelatedPaintings(
  paintingId: string,
  sectionId: string,
  limit = 4
): Promise<Painting[]> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("paintings")
      .select("*")
      .eq("section_id", sectionId)
      .neq("id", paintingId)
      .order("sort_order")
      .limit(limit)
    if (error) throw error
    return data ?? []
  } catch (err) {
    console.error("getRelatedPaintings error:", err)
    return []
  }
}

export async function getBio(): Promise<Bio | null> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.from("bio").select("*").single()
    if (error) throw error
    return data
  } catch (err) {
    console.error("getBio error:", err)
    return null
  }
}

export async function getUpcomingEvents(): Promise<Event[]> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("status", "upcoming")
      .order("starts_at")
    if (error) throw error
    return data ?? []
  } catch (err) {
    console.error("getUpcomingEvents error:", err)
    return []
  }
}

export async function getPastEvents(): Promise<Event[]> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("status", "past")
      .order("starts_at", { ascending: false })
    if (error) throw error
    return data ?? []
  } catch (err) {
    console.error("getPastEvents error:", err)
    return []
  }
}

export async function getPaintingsCount(): Promise<number> {
  try {
    const supabase = await createClient()
    const { count, error } = await supabase
      .from("paintings")
      .select("*", { count: "exact", head: true })
    if (error) throw error
    return count ?? 0
  } catch (err) {
    console.error("getPaintingsCount error:", err)
    return 0
  }
}

export async function getEventsCount(): Promise<number> {
  try {
    const supabase = await createClient()
    const { count, error } = await supabase
      .from("events")
      .select("*", { count: "exact", head: true })
    if (error) throw error
    return count ?? 0
  } catch (err) {
    console.error("getEventsCount error:", err)
    return 0
  }
}

export async function getNewInquiriesCount(): Promise<number> {
  try {
    const supabase = await createClient()
    const { count, error } = await supabase
      .from("inquiries")
      .select("*", { count: "exact", head: true })
      .eq("status", "new")
    if (error) throw error
    return count ?? 0
  } catch (err) {
    console.error("getNewInquiriesCount error:", err)
    return 0
  }
}
