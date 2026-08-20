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
  Newsletter,
  Painting,
  PaintingWithImages,
  PaintingWithImagesAndTags,
  Section,
  Settings,
  SectionWithCount,
  Tag,
} from "@/lib/types"

export interface PaintingForPicker extends Painting {
  section_slug: string
  section_title: string
}

// Used for contacts, inquiries, and newsletters (auth-only RLS policies)
async function db() {
  return isAuthBypassed() ? createAdminClient() : await createClient()
}

export async function getSections(): Promise<SectionWithCount[]> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("sections")
      .select("*, paintings!paintings_section_id_fkey(count)")
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

export async function getPublicSections(): Promise<SectionWithCount[]> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("sections")
      .select("*, paintings!paintings_section_id_fkey(count)")
      .neq("slug", "uncategorized")
      .order("sort_order")
    if (error) throw error
    return (data ?? []).map((s) => ({
      ...s,
      painting_count:
        (s.paintings as unknown as { count: number }[])[0]?.count ?? 0,
    }))
  } catch (err) {
    console.error("getPublicSections error:", err)
    return []
  }
}

export async function getUncategorizedPaintingCount(): Promise<number> {
  try {
    const supabase = await createClient()
    const { data: section } = await supabase
      .from("sections")
      .select("id")
      .eq("slug", "uncategorized")
      .single()
    if (!section) return 0
    const { count, error } = await supabase
      .from("paintings")
      .select("*", { count: "exact", head: true })
      .eq("section_id", section.id)
    if (error) throw error
    return count ?? 0
  } catch (err) {
    console.error("getUncategorizedPaintingCount error:", err)
    return 0
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

function twoTierSort<T extends { id: string; status: string; sort_order: number; sold_at: string | null }>(
  rows: T[]
): T[] {
  const active = rows
    .filter((p) => p.status !== "sold")
    .sort((a, b) =>
      a.sort_order !== b.sort_order
        ? a.sort_order - b.sort_order
        : a.id < b.id
          ? -1
          : a.id > b.id
            ? 1
            : 0
    )
  const sold = rows
    .filter((p) => p.status === "sold")
    .sort((a, b) => {
      const aT = a.sold_at ? new Date(a.sold_at).getTime() : 0
      const bT = b.sold_at ? new Date(b.sold_at).getTime() : 0
      if (aT !== bT) return bT - aT
      // 71 of 74 sold paintings have no sold_at, so without this every pair
      // compares equal and the owner's drag order is discarded.
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
    })
  return [...active, ...sold]
}

/** A painting plus the slug of its HOME gallery (for building its canonical URL). */
export type PaintingInGallery = Painting & { home_section_slug: string }

function attachHomeSlug(row: unknown): PaintingInGallery {
  const p = row as Painting & { sections?: { slug: string } | null }
  const home_section_slug = p.sections?.slug ?? ""
  const { sections: _drop, ...rest } = p
  void _drop
  return { ...(rest as Painting), home_section_slug }
}

export async function getPaintingsBySection(
  sectionId: string
): Promise<PaintingInGallery[]> {
  try {
    const supabase = await createClient()

    // Home paintings — those whose primary section is this one.
    const { data: homeData, error } = await supabase
      .from("paintings")
      .select("*, sections!paintings_section_id_fkey(slug)")
      .eq("section_id", sectionId)
      // Without an explicit order Postgres returns physical heap order, which
      // silently rearranges whenever any row is updated.
      .order("sort_order", { ascending: true })
      // sort_order is not unique, so a second key keeps the result deterministic.
      .order("id", { ascending: true })
    if (error) throw error
    const home = (homeData ?? []).map(attachHomeSlug)

    // Paintings ALSO shown in this gallery via the join table.
    // Fail-safe: if the painting_sections table doesn't exist yet (migration not
    // applied), this simply yields nothing and the gallery still renders.
    let linked: PaintingInGallery[] = []
    const { data: linkData } = await supabase
      .from("painting_sections")
      .select("paintings(*, sections!paintings_section_id_fkey(slug))")
      .eq("section_id", sectionId)
    if (linkData) {
      linked = linkData
        .map((l) => (l as { paintings: unknown }).paintings)
        .filter(Boolean)
        .map(attachHomeSlug)
    }

    const homeIds = new Set(home.map((p) => p.id))
    const merged = [...home, ...linked.filter((p) => !homeIds.has(p.id))]
    return twoTierSort(merged)
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

/**
 * Public URL of a painting's AR model (.glb) if one has been generated, else null.
 * No DB column needed — models live in the public `ar-models` storage bucket keyed
 * by painting id. Fail-safe: any error (incl. bucket missing) → no AR button.
 */
export async function getArModelUrl(paintingId: string): Promise<string | null> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) return null
  const url = `${base}/storage/v1/object/public/ar-models/${paintingId}.glb`
  try {
    const res = await fetch(url, {
      method: "HEAD",
      next: { revalidate: 3600 },
    })
    return res.ok ? url : null
  } catch {
    return null
  }
}

export async function getPaintingById(id: string): Promise<Painting | null> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("paintings")
      .select("*")
      .eq("id", id)
      .single()
    if (error) throw error
    return data
  } catch (err) {
    console.error("getPaintingById error:", err)
    return null
  }
}

export async function getAllPaintingsForPicker(): Promise<PaintingForPicker[]> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("paintings")
      .select("*, sections!paintings_section_id_fkey(slug, title, sort_order)")
      .neq("status", "sold")
      .order("sort_order")
    if (error) throw error
    return (data ?? [])
      .map((p) => {
        const sec = p.sections as { slug: string; title: string; sort_order: number } | null
        return {
          ...p,
          sections: undefined,
          section_slug: sec?.slug ?? "",
          section_title: sec?.title ?? "",
          _section_sort: sec?.sort_order ?? 0,
        }
      })
      .sort((a, b) => a._section_sort - b._section_sort || a.sort_order - b.sort_order)
      .map((p) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { _section_sort, ...rest } = p
        return rest as PaintingForPicker
      })
  } catch (err) {
    console.error("getAllPaintingsForPicker error:", err)
    return []
  }
}

export async function getFeaturedPainting(): Promise<Painting | null> {
  try {
    const supabase = await createClient()
    const { data: abs } = await supabase
      .from("sections")
      .select("id")
      .eq("slug", "abstracts")
      .maybeSingle()
    if (abs) {
      const { data } = await supabase
        .from("paintings")
        .select("*")
        .eq("section_id", abs.id)
        .eq("status", "available")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      if (data) return data
    }
    const { data } = await supabase
      .from("paintings")
      .select("*")
      .eq("status", "available")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    return data ?? null
  } catch (err) {
    console.error("getFeaturedPainting error:", err)
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

export async function getTagsForPainting(paintingId: string): Promise<Tag[]> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("painting_tags")
      .select("tags(id, name, created_at)")
      .eq("painting_id", paintingId)
    if (error) throw error
    return (data ?? [])
      .map((row) => (row.tags as unknown as Tag | null))
      .filter((t): t is Tag => t !== null)
  } catch (err) {
    console.error("getTagsForPainting error:", err)
    return []
  }
}

export async function searchTags(query: string, limit = 10): Promise<Tag[]> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("tags")
      .select("*")
      .ilike("name", `${query}%`)
      .order("name")
      .limit(limit)
    if (error) throw error
    return data ?? []
  } catch (err) {
    console.error("searchTags error:", err)
    return []
  }
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export async function getRelatedPaintings(
  paintingId: string,
  sectionId: string,
  limit = 4
): Promise<{ paintings: PaintingInGallery[]; source: "tags" | "section" }> {
  try {
    const supabase = await createClient()

    // Step 1: Get tag IDs for the current painting
    const { data: ptRows } = await supabase
      .from("painting_tags")
      .select("tag_id")
      .eq("painting_id", paintingId)

    const tagIds = (ptRows ?? []).map((r) => r.tag_id as string)

    let tagPaintings: PaintingInGallery[] = []

    if (tagIds.length > 0) {
      // Step 2: Find all paintings sharing those tags (excluding self)
      const { data: candidateRows } = await supabase
        .from("painting_tags")
        .select("painting_id")
        .in("tag_id", tagIds)
        .neq("painting_id", paintingId)

      // Count shared tags per candidate painting
      const countMap = new Map<string, number>()
      for (const row of candidateRows ?? []) {
        const pid = row.painting_id as string
        countMap.set(pid, (countMap.get(pid) ?? 0) + 1)
      }

      if (countMap.size > 0) {
        // Group by count, shuffle within each group, flatten in descending order
        const groups = new Map<number, string[]>()
        for (const [pid, cnt] of countMap) {
          if (!groups.has(cnt)) groups.set(cnt, [])
          groups.get(cnt)!.push(pid)
        }
        const sortedCounts = [...groups.keys()].sort((a, b) => b - a)
        const orderedIds: string[] = []
        for (const cnt of sortedCounts) {
          orderedIds.push(...shuffle(groups.get(cnt)!))
        }
        const topIds = orderedIds.slice(0, limit)

        const { data: paintings } = await supabase
          .from("paintings")
          .select("*, sections!paintings_section_id_fkey(slug)")
          .in("id", topIds)
        // Preserve the ranked order; attach each painting's home-section slug so
        // cross-section related links resolve to the correct canonical URL.
        const byId = new Map(
          (paintings ?? []).map((p) => [p.id, attachHomeSlug(p)])
        )
        tagPaintings = topIds
          .map((id) => byId.get(id))
          .filter((p): p is PaintingInGallery => !!p)
      }
    }

    // Step 3: Fill remainder from same section
    const needed = limit - tagPaintings.length
    let sectionFill: PaintingInGallery[] = []
    if (needed > 0) {
      const excludeIds = [paintingId, ...tagPaintings.map((p) => p.id)]
      const { data: sectionPaintings } = await supabase
        .from("paintings")
        .select("*, sections!paintings_section_id_fkey(slug)")
        .eq("section_id", sectionId)
        .not("id", "in", `(${excludeIds.join(",")})`)
        .limit(8)
      sectionFill = shuffle((sectionPaintings ?? []).map(attachHomeSlug)).slice(
        0,
        needed
      )
    }

    const paintings = [...tagPaintings, ...sectionFill]
    const source: "tags" | "section" = tagPaintings.length > 0 ? "tags" : "section"
    return { paintings, source }
  } catch (err) {
    console.error("getRelatedPaintings error:", err)
    return { paintings: [], source: "section" }
  }
}

/** Slug + home-section slug + freshness for building sitemap entries. */
export interface PaintingSitemapEntry {
  slug: string
  section_slug: string
  updated_at: string
}

export async function getPaintingsForSitemap(): Promise<PaintingSitemapEntry[]> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("paintings")
      .select("slug, created_at, sections!paintings_section_id_fkey(slug)")
      .order("created_at", { ascending: false })
    if (error) throw error
    return (data ?? [])
      .map((p) => {
        const section_slug =
          (p.sections as unknown as { slug: string } | null)?.slug ?? ""
        return {
          slug: p.slug as string,
          section_slug,
          updated_at: (p.created_at as string) ?? new Date().toISOString(),
        }
      })
      .filter(
        (p) =>
          p.slug && p.section_slug && p.section_slug !== "uncategorized"
      )
  } catch (err) {
    console.error("getPaintingsForSitemap error:", err)
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

export async function getCurrentEvents(): Promise<Event[]> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("status", "current")
      .order("starts_at")
    if (error) throw error
    return data ?? []
  } catch (err) {
    console.error("getCurrentEvents error:", err)
    return []
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
): Promise<PaintingWithImagesAndTags[]> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("paintings")
      .select("*, painting_images(id, url, alt, sort_order), painting_tags(tags(name))")
      .eq("section_id", sectionId)
      // Admin must show the same deterministic order the public site renders.
      .order("sort_order", { ascending: true })
      // sort_order is not unique, so a second key keeps the result deterministic.
      .order("id", { ascending: true })
    if (error) throw error
    const mapped = (data ?? []).map((p) => {
      type RawTag = { tags: { name: string } | null }
      const raw = p as typeof p & { painting_tags: RawTag[] }
      return {
        ...p,
        painting_images: ((p.painting_images ?? []) as PaintingWithImages["painting_images"]).sort(
          (a, b) => a.sort_order - b.sort_order
        ),
        tags: (raw.painting_tags ?? [])
          .map((pt: RawTag) => pt.tags?.name ?? null)
          .filter((n: string | null): n is string => typeof n === "string"),
      }
    })

    // Attach extra-gallery memberships. Fail-safe: if the painting_sections
    // table doesn't exist yet, memberships stay empty and the admin list still
    // renders normally.
    const ids = mapped.map((p) => p.id)
    if (ids.length > 0) {
      const { data: mem } = await supabase
        .from("painting_sections")
        .select("painting_id, section_id")
        .in("painting_id", ids)
      if (mem) {
        const byId = new Map<string, string[]>()
        for (const m of mem as { painting_id: string; section_id: string }[]) {
          const arr = byId.get(m.painting_id) ?? []
          arr.push(m.section_id)
          byId.set(m.painting_id, arr)
        }
        for (const p of mapped) {
          ;(p as PaintingWithImagesAndTags).extra_section_ids =
            byId.get(p.id) ?? []
        }
      }
    }

    return twoTierSort(mapped)
  } catch (err) {
    console.error("getPaintingsWithImagesForSection error:", err)
    return []
  }
}

export async function getAllEvents(): Promise<Event[]> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .neq("status", "cancelled")
      .order("starts_at")
    if (error) throw error
    return data ?? []
  } catch (err) {
    console.error("getAllEvents error:", err)
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
      .select("*, paintings(title, slug, sections!paintings_section_id_fkey(slug))")
      .order("created_at", { ascending: false })
    if (error) throw error
    return (data ?? []).map((inq) => {
      const painting = inq.paintings as {
        title: string
        slug: string
        sections: { slug: string } | null
      } | null
      return {
        ...inq,
        painting_title: painting?.title ?? null,
        painting_slug: painting?.slug ?? null,
        painting_section_slug: painting?.sections?.slug ?? null,
        paintings: undefined,
      }
    })
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

// Uses db() — newsletters has auth-only RLS
export async function getNewsletters(): Promise<Newsletter[]> {
  try {
    const supabase = await db()
    const { data, error } = await supabase
      .from("newsletters")
      .select("*")
      .order("sent_at", { ascending: false })
    if (error) throw error
    return (data ?? []) as Newsletter[]
  } catch (err) {
    console.error("getNewsletters error:", err)
    return []
  }
}

/** A painting plus its home section's slug/title — used by the show-cards admin tool. */
export interface PaintingForCards extends Painting {
  section_slug: string
  section_title: string
}

/**
 * ALL paintings (including sold — a show can include sold work) with the home
 * section embedded. Embed is pinned to the FK per the PGRST201 gotcha in
 * CLAUDE.md: a second sections<->paintings relationship (painting_sections)
 * makes the implicit embed ambiguous without `!paintings_section_id_fkey`.
 */
export async function getPaintingsForCards(): Promise<PaintingForCards[]> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("paintings")
      .select("*, sections!paintings_section_id_fkey(slug, title, sort_order)")
      .order("sort_order")
    if (error) throw error
    return (data ?? [])
      .map((p) => {
        const sec = p.sections as { slug: string; title: string; sort_order: number } | null
        return {
          ...p,
          sections: undefined,
          section_slug: sec?.slug ?? "",
          section_title: sec?.title ?? "",
          _section_sort: sec?.sort_order ?? 0,
        }
      })
      .sort((a, b) => a._section_sort - b._section_sort || a.sort_order - b.sort_order)
      .map((p) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { _section_sort, ...rest } = p
        return rest as PaintingForCards
      })
  } catch (err) {
    console.error("getPaintingsForCards error:", err)
    return []
  }
}

/**
 * IDs of paintings that have a generated AR model, derived from a single
 * `ar-models` storage bucket listing (files are named `<painting_id>.glb` —
 * see scripts/generate-ar-model.mjs). One list() call, not N HEAD requests.
 * Pages defensively past Supabase's 1000-row default page cap.
 *
 * Uses createAdminClient() directly (not the RLS-bound public client):
 * listing a storage bucket needs a `select` policy on `storage.objects`
 * that public/anon buckets don't grant by default (confirmed empirically —
 * the anon key lists 0 objects in `ar-models` even though individual object
 * URLs are publicly downloadable). This helper is only ever called from
 * requireUser()-gated admin routes, so bypassing RLS here is safe — same
 * rationale as submitCommissionInquiry's direct admin-client use.
 */
export async function getArModelIds(): Promise<Set<string>> {
  const ids = new Set<string>()
  try {
    const supabase = createAdminClient()
    const pageSize = 1000
    let offset = 0
    for (;;) {
      const { data, error } = await supabase.storage
        .from("ar-models")
        .list("", { limit: pageSize, offset })
      if (error) throw error
      for (const entry of data ?? []) {
        if (entry.name.toLowerCase().endsWith(".glb")) {
          ids.add(entry.name.replace(/\.glb$/i, ""))
        }
      }
      if (!data || data.length < pageSize) break
      offset += pageSize
    }
    return ids
  } catch (err) {
    console.error("getArModelIds error:", err)
    return ids
  }
}

export async function getSubscriberCount(): Promise<number> {
  try {
    const supabase = await db()
    const { count, error } = await supabase
      .from("contacts")
      .select("*", { count: "exact", head: true })
      .eq("subscribed", true)
    if (error) throw error
    return count ?? 0
  } catch (err) {
    console.error("getSubscriberCount error:", err)
    return 0
  }
}
