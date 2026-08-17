"use server"

import { revalidatePath } from "next/cache"
import { getUser, isAuthBypassed } from "@/lib/supabase/auth"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// ar-models is intentionally excluded — it stores 3D assets, not images.
const ALLOWED_BUCKETS = ["paintings", "events", "site-images", "headshots"] as const
export type MediaBucket = (typeof ALLOWED_BUCKETS)[number]

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

async function listBucketFolder(
  admin: AdminClient,
  bucket: MediaBucket,
  folder: string
): Promise<MediaItem[]> {
  const { data, error } = await admin.storage.from(bucket).list(folder, {
    limit: 500,
    sortBy: { column: "created_at", order: "desc" },
  })
  if (error || !data) return []

  const items: MediaItem[] = []
  for (const entry of data) {
    // Sub-folders (e.g. "crops") come back as entries with no id/metadata — skip.
    if (!entry.id || !entry.name) continue
    if (entry.name === ".emptyFolderPlaceholder") continue
    if (!IMAGE_EXT_RE.test(entry.name)) continue

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
      isCrop: folder === "crops",
    })
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
      buckets.flatMap((b) => [
        listBucketFolder(admin, b, ""),
        listBucketFolder(admin, b, "crops"),
      ])
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
