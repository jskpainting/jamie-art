"use server"

import { getUser, isAuthBypassed } from "@/lib/supabase/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

async function db() {
  return isAuthBypassed() ? createAdminClient() : await createClient()
}

export type SectionPaintingImage = {
  id: string
  title: string
  primary_image_url: string
}

/**
 * Lists the paintings (with images) in a section, for the "choose an existing
 * painting as the cover" picker. Auth-gated — admin only.
 */
export async function listSectionPaintingImages(
  sectionId: string
): Promise<
  | { ok: true; images: SectionPaintingImage[] }
  | { ok: false; error: string }
> {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  const supabase = await db()
  const { data, error } = await supabase
    .from("paintings")
    .select("id, title, primary_image_url, sort_order")
    .eq("section_id", sectionId)
    .not("primary_image_url", "is", null)
    .order("sort_order", { ascending: true })

  if (error) return { ok: false, error: error.message }

  const images = (data ?? [])
    .filter((p): p is { id: string; title: string; primary_image_url: string; sort_order: number } =>
      Boolean(p.primary_image_url)
    )
    .map(({ id, title, primary_image_url }) => ({ id, title, primary_image_url }))

  return { ok: true, images }
}
