"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { isAuthBypassed, getUser } from "@/lib/supabase/auth"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { SettingsSchema, type SettingsInput } from "@/lib/schemas"

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

  // Normalise empty strings to null so fallbacks kick in.
  const clean = Object.fromEntries(
    Object.entries(parsed.data).map(([k, v]) => [
      k,
      typeof v === "string" && v.trim() === "" ? null : v,
    ])
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
      const { error } = await supabase
        .from("settings")
        .update({ [field]: parsed.data, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
      if (error) throw error
    }
    revalidateMap[field].forEach((p) => revalidatePath(p))
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update image" }
  }
}
