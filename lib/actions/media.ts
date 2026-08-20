"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getUser, isAuthBypassed } from "@/lib/supabase/auth"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// ar-models is intentionally excluded — it stores 3D assets, not images.
const ALLOWED_BUCKETS = ["paintings", "events", "site-images", "headshots"] as const
export type MediaBucket = (typeof ALLOWED_BUCKETS)[number]

/**
 * Parse a Supabase public storage URL into { bucket, path }, or null.
 * Deliberately duplicated from lib/image-edit.ts rather than imported: that
 * module is client-only (Canvas/Image APIs) and must not be pulled into a
 * "use server" file.
 */
function parsePublicStorageUrl(
  url: string
): { bucket: string; path: string } | null {
  const marker = "/storage/v1/object/public/"
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  const rest = url.slice(idx + marker.length)
  const slash = rest.indexOf("/")
  if (slash === -1) return null
  return { bucket: rest.slice(0, slash), path: rest.slice(slash + 1) }
}

const IMAGE_EXT_RE = /\.(jpe?g|png|webp|gif)$/i

export interface MediaItem {
  bucket: MediaBucket
  path: string
  url: string
  size: number
  createdAt: string | null
  isCrop: boolean
}

export interface MediaUsage {
  label: string
  adminHref: string
}

async function db() {
  return isAuthBypassed() ? createAdminClient() : await createServerClient()
}

type AdminClient = ReturnType<typeof createAdminClient>

// Safety caps for the recursive walk — painting images live in per-section
// folders (e.g. "abstracts/emergence.JPG"), so listing must recurse, but a
// bounded depth + item count keeps a single admin page load fast and finite.
const MAX_LIST_DEPTH = 2
const MAX_ITEMS_PER_BUCKET = 1000

async function listBucketFolder(
  admin: AdminClient,
  bucket: MediaBucket,
  folder: string,
  depth = 0,
  budget: { remaining: number } = { remaining: MAX_ITEMS_PER_BUCKET }
): Promise<MediaItem[]> {
  if (budget.remaining <= 0) return []

  const { data, error } = await admin.storage.from(bucket).list(folder, {
    limit: 500,
    sortBy: { column: "created_at", order: "desc" },
  })
  if (error || !data) return []

  const items: MediaItem[] = []
  const subfolders: string[] = []
  for (const entry of data) {
    if (entry.name === ".emptyFolderPlaceholder") continue

    // Supabase Storage returns folder entries with no id/metadata. Recurse
    // into them (bounded by MAX_LIST_DEPTH) instead of skipping — painting
    // images live under per-section prefixes like "abstracts/emergence.JPG".
    if (!entry.id) {
      if (depth < MAX_LIST_DEPTH) subfolders.push(entry.name)
      continue
    }

    if (!entry.name || !IMAGE_EXT_RE.test(entry.name)) continue
    if (budget.remaining <= 0) break

    const path = folder ? `${folder}/${entry.name}` : entry.name
    const {
      data: { publicUrl },
    } = admin.storage.from(bucket).getPublicUrl(path)

    items.push({
      bucket,
      path,
      url: publicUrl,
      size: entry.metadata?.size ?? 0,
      createdAt: entry.created_at ?? null,
      isCrop: folder === "crops" || folder.split("/").pop() === "crops",
    })
    budget.remaining--
  }

  for (const sub of subfolders) {
    if (budget.remaining <= 0) break
    const subPath = folder ? `${folder}/${sub}` : sub
    const subItems = await listBucketFolder(admin, bucket, subPath, depth + 1, budget)
    items.push(...subItems)
  }

  return items
}

/** Lists every uploaded image (plus its "crops" derivatives) across allowed buckets, newest first. */
export async function listMedia(
  bucket?: string
): Promise<{ ok: true; data: MediaItem[] } | { ok: false; error: string }> {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  const buckets: MediaBucket[] =
    bucket && (ALLOWED_BUCKETS as readonly string[]).includes(bucket)
      ? [bucket as MediaBucket]
      : [...ALLOWED_BUCKETS]

  try {
    const admin = createAdminClient()
    const results = await Promise.all(
      buckets.map((b) => listBucketFolder(admin, b, ""))
    )
    const all = results.flat().sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return tb - ta
    })
    return { ok: true, data: all }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to list media" }
  }
}

/** Finds every place a public storage URL is referenced on the live site. */
export async function getMediaUsage(
  url: string
): Promise<{ ok: true; data: MediaUsage[] } | { ok: false; error: string }> {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  try {
    const supabase = await db()
    const usage: MediaUsage[] = []

    const { data: settings } = await supabase
      .from("settings")
      .select("home_hero_image_url, about_image_url, commission_image_url")
      .maybeSingle()
    if (settings?.home_hero_image_url === url) {
      usage.push({ label: "Home page hero", adminHref: "/admin/settings" })
    }
    if (settings?.about_image_url === url) {
      usage.push({ label: "About page photo", adminHref: "/admin/settings" })
    }
    if (settings?.commission_image_url === url) {
      usage.push({ label: "Commission page photo", adminHref: "/admin/settings" })
    }

    const { data: bio } = await supabase.from("bio").select("headshot_url").maybeSingle()
    if (bio?.headshot_url === url) {
      usage.push({ label: "About page headshot", adminHref: "/admin/bio" })
    }

    const { data: paintings } = await supabase
      .from("paintings")
      .select("title, sections!paintings_section_id_fkey(slug)")
      .eq("primary_image_url", url)
    for (const p of paintings ?? []) {
      const sectionSlug = (p as { sections?: { slug?: string } | null }).sections?.slug
      usage.push({
        label: `Painting: ${p.title}`,
        adminHref: sectionSlug ? `/admin/portfolio/${sectionSlug}` : "/admin/portfolio",
      })
    }

    const { data: paintingImages } = await supabase
      .from("painting_images")
      .select("paintings(title, sections!paintings_section_id_fkey(slug))")
      .eq("url", url)
    for (const row of paintingImages ?? []) {
      const painting = (
        row as { paintings?: { title?: string; sections?: { slug?: string } | null } | null }
      ).paintings
      const sectionSlug = painting?.sections?.slug
      usage.push({
        label: `Extra image on: ${painting?.title ?? "a painting"}`,
        adminHref: sectionSlug ? `/admin/portfolio/${sectionSlug}` : "/admin/portfolio",
      })
    }

    const { data: events } = await supabase.from("events").select("title").eq("image_url", url)
    for (const ev of events ?? []) {
      usage.push({ label: `Event: ${ev.title}`, adminHref: "/admin/events" })
    }

    const { data: sections } = await supabase
      .from("sections")
      .select("title")
      .eq("cover_image_url", url)
    for (const s of sections ?? []) {
      usage.push({ label: `Gallery cover: ${s.title}`, adminHref: "/admin/portfolio" })
    }

    return { ok: true, data: usage }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to check image usage" }
  }
}

/** Deletes a stored image, but only if it isn't referenced anywhere on the live site. */
export async function deleteMedia(
  bucket: string,
  path: string
): Promise<{ ok: boolean; error?: string }> {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  if (!(ALLOWED_BUCKETS as readonly string[]).includes(bucket)) {
    return { ok: false, error: "Invalid bucket" }
  }

  try {
    const admin = createAdminClient()
    const {
      data: { publicUrl },
    } = admin.storage.from(bucket).getPublicUrl(path)

    const usageResult = await getMediaUsage(publicUrl)
    if (!usageResult.ok) return { ok: false, error: usageResult.error }
    if (usageResult.data.length > 0) {
      const places = usageResult.data.map((u) => u.label).join(", ")
      return {
        ok: false,
        error: `This photo is used on your site (${places}). Remove it there first.`,
      }
    }

    const { error } = await admin.storage.from(bucket).remove([path])
    if (error) return { ok: false, error: error.message }

    revalidatePath("/admin/media")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to delete image" }
  }
}

const UrlSchema = z.string().url()

export interface ReplaceImageUrlResult {
  ok: boolean
  replaced: number
  places: string[]
  error?: string
}

/**
 * Points every live reference to `oldUrl` at `newUrl` instead. Mirrors
 * `getMediaUsage` column-for-column (as UPDATEs instead of SELECTs) so the
 * two can never drift — "where is this used" and "where do I replace it"
 * stay the same list by construction.
 */
export async function replaceImageUrl(
  oldUrl: string,
  newUrl: string
): Promise<ReplaceImageUrlResult> {
  const user = await getUser()
  if (!user) return { ok: false, replaced: 0, places: [], error: "Unauthorized" }

  const oldParsed = UrlSchema.safeParse(oldUrl)
  const newParsed = UrlSchema.safeParse(newUrl)
  if (!oldParsed.success || !newParsed.success) {
    return { ok: false, replaced: 0, places: [], error: "Invalid image URL" }
  }

  // Defense in depth: this action rewrites the image URL on the home hero, the
  // About/Commission photos, paintings, events and gallery covers at once. A
  // syntactically-valid URL is not enough — confine the replacement to a public
  // object in one of OUR OWN storage buckets, so it can never repoint the live
  // site's imagery at an external host.
  const target = parsePublicStorageUrl(newParsed.data)
  if (
    !target ||
    !(ALLOWED_BUCKETS as readonly string[]).includes(target.bucket) ||
    !newParsed.data.startsWith(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/`)
  ) {
    return {
      ok: false,
      replaced: 0,
      places: [],
      error: "New image must be a file in your own image library.",
    }
  }

  try {
    const supabase = await db()
    let replaced = 0
    const places: string[] = []
    // Static public routes revalidate as-is; dynamic section/painting
    // subtree pages revalidate with "layout" so nested detail pages pick up
    // the change too.
    const staticRoutes = new Set<string>()
    const layoutRoutes = new Set<string>()

    const { data: heroRows, error: heroErr } = await supabase
      .from("settings")
      .update({ home_hero_image_url: newUrl })
      .eq("home_hero_image_url", oldUrl)
      .select("id")
    if (heroErr) throw heroErr
    if (heroRows && heroRows.length > 0) {
      replaced += heroRows.length
      places.push("Home page hero")
      staticRoutes.add("/")
    }

    const { data: aboutRows, error: aboutErr } = await supabase
      .from("settings")
      .update({ about_image_url: newUrl })
      .eq("about_image_url", oldUrl)
      .select("id")
    if (aboutErr) throw aboutErr
    if (aboutRows && aboutRows.length > 0) {
      replaced += aboutRows.length
      places.push("About page photo")
      staticRoutes.add("/about")
    }

    const { data: commissionRows, error: commissionErr } = await supabase
      .from("settings")
      .update({ commission_image_url: newUrl })
      .eq("commission_image_url", oldUrl)
      .select("id")
    if (commissionErr) throw commissionErr
    if (commissionRows && commissionRows.length > 0) {
      replaced += commissionRows.length
      places.push("Commission page photo")
      staticRoutes.add("/commission")
    }

    const { data: bioRows, error: bioErr } = await supabase
      .from("bio")
      .update({ headshot_url: newUrl })
      .eq("headshot_url", oldUrl)
      .select("id")
    if (bioErr) throw bioErr
    if (bioRows && bioRows.length > 0) {
      replaced += bioRows.length
      places.push("About page headshot")
      staticRoutes.add("/about")
    }

    const { data: paintingRows, error: paintingErr } = await supabase
      .from("paintings")
      .update({ primary_image_url: newUrl })
      .eq("primary_image_url", oldUrl)
      .select("title, slug, sections!paintings_section_id_fkey(slug)")
    if (paintingErr) throw paintingErr
    for (const p of paintingRows ?? []) {
      replaced++
      places.push(`Painting: ${p.title}`)
      const sectionSlug = (p as { sections?: { slug?: string } | null }).sections?.slug
      staticRoutes.add("/portfolio")
      if (sectionSlug) {
        layoutRoutes.add(`/portfolio/${sectionSlug}`)
        layoutRoutes.add(`/portfolio/${sectionSlug}/${p.slug}`)
      }
    }

    const { data: paintingImageRows, error: paintingImageErr } = await supabase
      .from("painting_images")
      .update({ url: newUrl })
      .eq("url", oldUrl)
      .select("paintings(title, slug, sections!paintings_section_id_fkey(slug))")
    if (paintingImageErr) throw paintingImageErr
    for (const row of paintingImageRows ?? []) {
      replaced++
      const painting = (
        row as {
          paintings?: { title?: string; slug?: string; sections?: { slug?: string } | null } | null
        }
      ).paintings
      places.push(`Extra image on: ${painting?.title ?? "a painting"}`)
      const sectionSlug = painting?.sections?.slug
      staticRoutes.add("/portfolio")
      if (sectionSlug && painting?.slug) {
        layoutRoutes.add(`/portfolio/${sectionSlug}`)
        layoutRoutes.add(`/portfolio/${sectionSlug}/${painting.slug}`)
      }
    }

    const { data: eventRows, error: eventErr } = await supabase
      .from("events")
      .update({ image_url: newUrl })
      .eq("image_url", oldUrl)
      .select("title")
    if (eventErr) throw eventErr
    for (const ev of eventRows ?? []) {
      replaced++
      places.push(`Event: ${ev.title}`)
      staticRoutes.add("/events")
      staticRoutes.add("/")
    }

    const { data: sectionRows, error: sectionErr } = await supabase
      .from("sections")
      .update({ cover_image_url: newUrl })
      .eq("cover_image_url", oldUrl)
      .select("title")
    if (sectionErr) throw sectionErr
    for (const s of sectionRows ?? []) {
      replaced++
      places.push(`Gallery cover: ${s.title}`)
      staticRoutes.add("/portfolio")
    }

    for (const path of staticRoutes) revalidatePath(path)
    for (const path of layoutRoutes) revalidatePath(path, "layout")
    revalidatePath("/admin/media")

    return { ok: true, replaced, places }
  } catch (e) {
    return {
      ok: false,
      replaced: 0,
      places: [],
      error: e instanceof Error ? e.message : "Failed to update references",
    }
  }
}
