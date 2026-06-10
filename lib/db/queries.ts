import { createClient } from "@/lib/supabase/server"
import { isAuthBypassed } from "@/lib/supabase/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import type {
  Bio,
  CommissionInquiry,
  CommissionInquiriesStats,
  Contact,
  ContactsStats,
  Event,
  Inquiry,
  InquiriesStats,
  InquiryWithPainting,
  Painting,
  PaintingWithImages,
  Section,
  Settings,
  SectionWithCount,
} from "@/lib/types"

// Used only for contacts + inquiries (auth-only RLS policies)
async function db() {
  return isAuthBypassed() ? createAdminClient() : await createClient()
}

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

// Uses db() — inquiries has auth-only RLS
export async function getNewInquiriesCount(): Promise<number> {
  try {
    const supabase = await db()
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

export async function getPaintingsWithImagesForSection(
  sectionId: string
): Promise<PaintingWithImages[]> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("paintings")
      .select("*, painting_images(id, url, alt, sort_order)")
      .eq("section_id", sectionId)
      .order("sort_order")
    if (error) throw error
    return (data ?? []).map((p) => ({
      ...p,
      painting_images: ((p.painting_images ?? []) as PaintingWithImages["painting_images"]).sort(
        (a, b) => a.sort_order - b.sort_order
      ),
    }))
  } catch (err) {
    console.error("getPaintingsWithImagesForSection error:", err)
    return []
  }
}

// Uses db() — contacts has auth-only RLS
export async function getAllContacts(): Promise<Contact[]> {
  try {
    const supabase = await db()
    const { data, error } = await supabase
      .from("contacts")
      .select("*")
      .order("created_at", { ascending: false })
    if (error) throw error
    return data ?? []
  } catch (err) {
    console.error("getAllContacts error:", err)
    return []
  }
}

// Uses db() — contacts has auth-only RLS
export async function getContactsStats(): Promise<ContactsStats> {
  try {
    const supabase = await db()
    const { count: total } = await supabase
      .from("contacts")
      .select("*", { count: "exact", head: true })
    const { count: subscribed } = await supabase
      .from("contacts")
      .select("*", { count: "exact", head: true })
      .eq("subscribed", true)
    return {
      total: total ?? 0,
      subscribed: subscribed ?? 0,
      unsubscribed: (total ?? 0) - (subscribed ?? 0),
    }
  } catch (err) {
    console.error("getContactsStats error:", err)
    return { total: 0, subscribed: 0, unsubscribed: 0 }
  }
}

// Uses db() — inquiries has auth-only RLS
export async function getInquiriesWithPainting(): Promise<InquiryWithPainting[]> {
  try {
    const supabase = await db()
    const { data, error } = await supabase
      .from("inquiries")
      .select("*, paintings(title)")
      .order("created_at", { ascending: false })
    if (error) throw error
    return (data ?? []).map((inq) => ({
      ...inq,
      painting_title:
        (inq.paintings as { title: string } | null)?.title ?? null,
      paintings: undefined,
    }))
  } catch (err) {
    console.error("getInquiriesWithPainting error:", err)
    return []
  }
}

// Uses db() — inquiries has auth-only RLS
export async function getInquiriesStats(): Promise<InquiriesStats> {
  try {
    const supabase = await db()
    const [{ count: n }, { count: r }, { count: c }] = await Promise.all([
      supabase
        .from("inquiries")
        .select("*", { count: "exact", head: true })
        .eq("status", "new"),
      supabase
        .from("inquiries")
        .select("*", { count: "exact", head: true })
        .eq("status", "replied"),
      supabase
        .from("inquiries")
        .select("*", { count: "exact", head: true })
        .eq("status", "closed"),
    ])
    return {
      new_count: n ?? 0,
      replied_count: r ?? 0,
      closed_count: c ?? 0,
    }
  } catch (err) {
    console.error("getInquiriesStats error:", err)
    return { new_count: 0, replied_count: 0, closed_count: 0 }
  }
}

// Uses db() — inquiries has auth-only RLS
export async function getRecentInquiries(limit = 5): Promise<Inquiry[]> {
  try {
    const supabase = await db()
    const { data, error } = await supabase
      .from("inquiries")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit)
    if (error) throw error
    return data ?? []
  } catch (err) {
    console.error("getRecentInquiries error:", err)
    return []
  }
}

// Uses db() — contacts has auth-only RLS
export async function getRecentContacts(limit = 5): Promise<Contact[]> {
  try {
    const supabase = await db()
    const { data, error } = await supabase
      .from("contacts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit)
    if (error) throw error
    return data ?? []
  } catch (err) {
    console.error("getRecentContacts error:", err)
    return []
  }
}

// settings has public RLS — no db() needed
export async function getSettings(): Promise<Settings | null> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("settings")
      .select("*")
      .single()
    if (error) throw error
    return data
  } catch (err) {
    console.error("getSettings error:", err)
    return null
  }
}

// Uses db() — commission_inquiries has auth-only read RLS
export async function getAllCommissionInquiries(): Promise<CommissionInquiry[]> {
  try {
    const supabase = await db()
    const { data, error } = await supabase
      .from("commission_inquiries")
      .select("*")
      .order("created_at", { ascending: false })
    if (error) throw error
    return data ?? []
  } catch (err) {
    console.error("getAllCommissionInquiries error:", err)
    return []
  }
}

// Uses db() — commission_inquiries has auth-only read RLS
export async function getCommissionInquiriesStats(): Promise<CommissionInquiriesStats> {
  try {
    const supabase = await db()
    const [{ count: n }, { count: r }, { count: c }] = await Promise.all([
      supabase
        .from("commission_inquiries")
        .select("*", { count: "exact", head: true })
        .eq("status", "new"),
      supabase
        .from("commission_inquiries")
        .select("*", { count: "exact", head: true })
        .eq("status", "replied"),
      supabase
        .from("commission_inquiries")
        .select("*", { count: "exact", head: true })
        .eq("status", "closed"),
    ])
    return {
      new_count: n ?? 0,
      replied_count: r ?? 0,
      closed_count: c ?? 0,
    }
  } catch (err) {
    console.error("getCommissionInquiriesStats error:", err)
    return { new_count: 0, replied_count: 0, closed_count: 0 }
  }
}

// Uses db() — commission_inquiries has auth-only read RLS
export async function getRecentCommissionInquiries(
  limit = 5
): Promise<CommissionInquiry[]> {
  try {
    const supabase = await db()
    const { data, error } = await supabase
      .from("commission_inquiries")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit)
    if (error) throw error
    return data ?? []
  } catch (err) {
    console.error("getRecentCommissionInquiries error:", err)
    return []
  }
}
