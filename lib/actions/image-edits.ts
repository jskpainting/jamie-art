"use server"

import { isAuthBypassed, getUser } from "@/lib/supabase/auth"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { ImageEditSchema, type ImageEditInput } from "@/lib/schemas"
import {
  isSchemaSetupError,
  SCHEMA_SETUP_MESSAGE,
  getSchemaCapabilities,
} from "@/lib/schema-capabilities"
import type { EditRecipe } from "@/lib/image-edit"

async function db() {
  return isAuthBypassed() ? createAdminClient() : await createServerClient()
}

/**
 * Lets the client-side `ImageUploadCropper` (used across ~8 unrelated admin
 * pages) decide on its own whether to show the Edit affordance, without every
 * host page having to fetch + prop-drill `capabilities.imageEdits` down to
 * it individually.
 */
export async function checkImageEditsEnabled(): Promise<boolean> {
  const user = await getUser()
  if (!user) return false
  const capabilities = await getSchemaCapabilities()
  return capabilities.imageEdits
}

export async function recordImageEdit(input: ImageEditInput) {
  const user = await getUser()
  if (!user) return { ok: false as const, error: "Unauthorized" }

  const parsed = ImageEditSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0].message }
  }

  try {
    const supabase = await db()
    const { error } = await supabase
      .from("image_edits")
      .upsert(
        {
          bucket: parsed.data.bucket,
          path: parsed.data.path,
          source_bucket: parsed.data.source_bucket,
          source_path: parsed.data.source_path,
          recipe: parsed.data.recipe,
        },
        { onConflict: "bucket,path" }
      )
    if (error) throw error
    return { ok: true as const }
  } catch (e) {
    if (isSchemaSetupError(e)) {
      return { ok: false as const, error: SCHEMA_SETUP_MESSAGE }
    }
    const message = e instanceof Error ? e.message : "Failed to record edit"
    return { ok: false as const, error: message }
  }
}

export interface ImageEditRecord {
  bucket: string
  path: string
  source_bucket: string
  source_path: string
  recipe: EditRecipe
}

export async function getImageEdit(bucket: string, path: string) {
  const user = await getUser()
  if (!user) return { ok: false as const, error: "Unauthorized" }

  try {
    const supabase = await db()
    const { data, error } = await supabase
      .from("image_edits")
      .select("bucket, path, source_bucket, source_path, recipe")
      .eq("bucket", bucket)
      .eq("path", path)
      .maybeSingle()
    if (error) throw error
    return { ok: true as const, data: (data as ImageEditRecord | null) ?? null }
  } catch (e) {
    if (isSchemaSetupError(e)) {
      return { ok: false as const, error: SCHEMA_SETUP_MESSAGE }
    }
    const message = e instanceof Error ? e.message : "Failed to look up edit"
    return { ok: false as const, error: message }
  }
}
