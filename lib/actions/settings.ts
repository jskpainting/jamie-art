"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { isAuthBypassed, getUser } from "@/lib/supabase/auth"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { SettingsSchema, type SettingsInput, FocalSchema, GalleryLayoutSchema } from "@/lib/schemas"
import { isSchemaSetupError, SCHEMA_SETUP_MESSAGE } from "@/lib/schema-capabilities"
import { SITE_COPY_DEFAULTS } from "@/lib/site-copy"
import type { GalleryLayout } from "@/lib/types"

async function db() {
  return isAuthBypassed() ? createAdminClient() : await createServerClient()
}

export async function updateSettings(input: SettingsInput) {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  const parsed = SettingsSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  try {
    const supabase = await db()
    const { data: existing } = await supabase.from("settings").select("id").single()

    if (existing) {
      const { error } = await supabase
        .from("settings")
        .update({ ...parsed.data, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
      if (error) throw error
    } else {
      const { error } = await supabase.from("settings").insert(parsed.data)
      if (error) throw error
    }

    revalidatePath("/admin/settings")
    revalidatePath("/")
    revalidatePath("/contact")
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update settings"
    return { ok: false, error: message }
  }
}

const SiteCopySchema = z.object({
  tagline: z.string().max(120).nullable().optional(),
  commission_intro: z.string().max(2000).nullable().optional(),
  contact_intro: z.string().max(2000).nullable().optional(),
})
export type SiteCopyInput = z.infer<typeof SiteCopySchema>

export async function updateSiteCopy(input: SiteCopyInput) {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  const parsed = SiteCopySchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  // Maps each settings column to the default it should collapse back to null for.
  // `tagline` backs both the nav and hero taglines — SITE_COPY_DEFAULTS.tagline_nav
  // is the one shown in the admin editor, so it's the one we compare against.
  const DEFAULT_BY_FIELD: Record<string, string> = {
    tagline: SITE_COPY_DEFAULTS.tagline_nav,
    commission_intro: SITE_COPY_DEFAULTS.commission_intro,
    contact_intro: SITE_COPY_DEFAULTS.contact_intro,
  }

  // Normalise empty strings — and text matching the built-in default — to null
  // so the fallback in SITE_COPY_DEFAULTS kicks in instead of storing a duplicate.
  const clean = Object.fromEntries(
    Object.entries(parsed.data).map(([k, v]) => {
      if (typeof v !== "string") return [k, v]
      const trimmed = v.trim()
      if (trimmed === "" || trimmed === DEFAULT_BY_FIELD[k]) return [k, null]
      return [k, v]
    })
  )

  try {
    const supabase = await db()
    const { data: existing } = await supabase.from("settings").select("id").single()
    if (existing) {
      const { error } = await supabase
        .from("settings")
        .update({ ...clean, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
      if (error) throw error
    } else {
      const { error } = await supabase.from("settings").insert(clean)
      if (error) throw error
    }
    revalidatePath("/")
    revalidatePath("/commission")
    revalidatePath("/contact")
    revalidatePath("/admin/settings")
    return { ok: true }
  } catch (e) {
    if (isSchemaSetupError(e)) return { ok: false, error: SCHEMA_SETUP_MESSAGE }
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update site copy" }
  }
}

const IMAGE_FIELDS = [
  "home_hero_image_url",
  "about_image_url",
  "commission_image_url",
] as const
export type ImageField = (typeof IMAGE_FIELDS)[number]

const revalidateMap: Record<ImageField, string[]> = {
  home_hero_image_url:  ["/", "/admin/settings"],
  about_image_url:      ["/about", "/admin/settings"],
  commission_image_url: ["/commission", "/admin/settings"],
}

const UrlOrNullSchema = z.string().url().nullable()

// Only fields with a matching focal-point picker in the admin UI.
const IMAGE_FOCAL_FIELDS: Partial<Record<ImageField, { x: string; y: string }>> = {
  home_hero_image_url: { x: "home_hero_focal_x", y: "home_hero_focal_y" },
  commission_image_url: { x: "commission_focal_x", y: "commission_focal_y" },
}

export async function updateFeaturedPainting(paintingId: string | null) {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  try {
    const supabase = await db()

    if (paintingId !== null) {
      const { data: painting } = await supabase
        .from("paintings")
        .select("id")
        .eq("id", paintingId)
        .single()
      if (!painting) return { ok: false, error: "Painting not found" }
    }

    const { data: existing } = await supabase.from("settings").select("id").single()
    if (existing) {
      const { error } = await supabase
        .from("settings")
        .update({ featured_painting_id: paintingId, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
      if (error) throw error
    }

    revalidatePath("/")
    revalidatePath("/admin/settings")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update featured painting" }
  }
}

export async function updateSettingImage(field: ImageField, url: string | null) {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  if (!(IMAGE_FIELDS as readonly string[]).includes(field))
    return { ok: false, error: "Invalid field" }

  const parsed = UrlOrNullSchema.safeParse(url === "" ? null : url)
  if (!parsed.success) return { ok: false, error: "Invalid URL" }

  try {
    const supabase = await db()
    const { data: existing } = await supabase.from("settings").select("id").single()
    if (existing) {
      const focal = IMAGE_FOCAL_FIELDS[field]
      // A freshly-uploaded photo resets its focal point back to center — a
      // stale focal point from the old photo is a trap. Only attempted when
      // the focal columns exist (pre-migration this quietly falls back).
      const payload: Record<string, unknown> = {
        [field]: parsed.data,
        updated_at: new Date().toISOString(),
      }
      if (parsed.data && focal) {
        payload[focal.x] = 50
        payload[focal.y] = 50
      }

      let { error } = await supabase.from("settings").update(payload).eq("id", existing.id)
      if (error && isSchemaSetupError(error) && parsed.data && focal) {
        const fallback = { [field]: parsed.data, updated_at: new Date().toISOString() }
        ;({ error } = await supabase.from("settings").update(fallback).eq("id", existing.id))
      }
      if (error) throw error
    }
    revalidateMap[field].forEach((p) => revalidatePath(p))
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update image" }
  }
}

export async function updateSettingFocal(field: ImageField, x: number, y: number) {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  const focal = IMAGE_FOCAL_FIELDS[field]
  if (!focal) return { ok: false, error: "Invalid field" }

  const xParsed = FocalSchema.safeParse(x)
  const yParsed = FocalSchema.safeParse(y)
  if (!xParsed.success || !yParsed.success) {
    return { ok: false, error: "Focal point must be between 0 and 100" }
  }

  try {
    const supabase = await db()
    const { data: existing } = await supabase.from("settings").select("id").single()
    if (existing) {
      const { error } = await supabase
        .from("settings")
        .update({
          [focal.x]: xParsed.data,
          [focal.y]: yParsed.data,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
      if (error) throw error
    }
    revalidateMap[field].forEach((p) => revalidatePath(p))
    return { ok: true }
  } catch (e) {
    if (isSchemaSetupError(e)) return { ok: false, error: SCHEMA_SETUP_MESSAGE }
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update focal point" }
  }
}

export async function updateActiveLayout(layout: GalleryLayout) {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  const parsed = GalleryLayoutSchema.safeParse(layout)
  if (!parsed.success) return { ok: false, error: "Invalid layout" }

  try {
    const supabase = await db()
    const { data: existing } = await supabase.from("settings").select("id").single()
    if (existing) {
      const { error } = await supabase
        .from("settings")
        .update({ active_layout: parsed.data, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
      if (error) throw error
    }
    revalidatePath("/portfolio")
    revalidatePath("/portfolio/[section]", "page")
    revalidatePath("/admin/layout-preview")
    return { ok: true }
  } catch (e) {
    if (isSchemaSetupError(e)) return { ok: false, error: SCHEMA_SETUP_MESSAGE }
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update layout" }
  }
}
