// Server-only: uses the Supabase admin client (service role key). The
// `server-only` package isn't installed in this project, so this file just
// relies on nothing here being importable from a client component.
import sharp from "sharp"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  buildGlb,
  parsePhysicalInches,
  IN_TO_M,
  arModelPublicUrl,
} from "@/lib/ar/build-glb"

export { arModelPublicUrl }

export type GenerateArModelResult =
  | { ok: true; skipped?: "no-image" | "no-dimensions" | "exists" }
  | { ok: false; error: string }

/**
 * Generate (or refresh) the AR "canvas in the room" GLB model for a painting
 * and upload it to the public `ar-models` bucket as `<paintingId>.glb`.
 *
 * Never throws — logs with console.error and returns { ok: false } instead,
 * since this is called from fire-and-forget `after()` hooks.
 */
export async function generateArModel(
  paintingId: string,
  opts?: { force?: boolean }
): Promise<GenerateArModelResult> {
  const force = opts?.force ?? false
  try {
    const admin = createAdminClient()
    const { data: painting, error } = await admin
      .from("paintings")
      .select("title, dimensions, primary_image_url")
      .eq("id", paintingId)
      .single()
    if (error || !painting) {
      console.error("[ar] painting lookup failed", paintingId, error)
      return { ok: false, error: "Painting not found" }
    }

    if (!painting.primary_image_url) return { ok: true, skipped: "no-image" }

    const dims = parsePhysicalInches(painting.dimensions)
    if (!dims) return { ok: true, skipped: "no-dimensions" }

    if (!force) {
      // Cheap existence check for the batch/backfill path — avoid redoing
      // work for paintings that already have a model.
      try {
        const head = await fetch(arModelPublicUrl(paintingId), { method: "HEAD" })
        if (head.ok) return { ok: true, skipped: "exists" }
      } catch {
        // Network hiccup on the HEAD check — fall through and (re)generate.
      }
    }

    const [wIn, hIn] = dims

    const imgRes = await fetch(painting.primary_image_url)
    if (!imgRes.ok) {
      console.error("[ar] image fetch failed", paintingId, imgRes.status)
      return { ok: false, error: "Failed to fetch painting image" }
    }
    const imgBuf = Buffer.from(await imgRes.arrayBuffer())

    const jpeg = await sharp(imgBuf)
      .rotate()
      .resize(2048, 2048, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 90 })
      .toBuffer()

    const glb = buildGlb(jpeg, wIn * IN_TO_M, hIn * IN_TO_M)

    const { error: uploadError } = await admin.storage
      .from("ar-models")
      .upload(`${paintingId}.glb`, glb, {
        contentType: "model/gltf-binary",
        upsert: true,
      })
    if (uploadError) {
      console.error("[ar] upload failed", paintingId, uploadError)
      return { ok: false, error: uploadError.message }
    }

    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to generate AR model"
    console.error("[ar] generateArModel failed", paintingId, e)
    return { ok: false, error: message }
  }
}
