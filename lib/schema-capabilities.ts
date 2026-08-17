import { isAuthBypassed } from "@/lib/supabase/auth"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * Which optional DB migrations have been applied. Lets the admin UI HIDE controls
 * whose backing schema isn't present yet, so nothing can throw a raw DB error on
 * the live site. Each control lights up automatically once the migration runs.
 */
export interface SchemaCapabilities {
  /** painting_sections join table → the "Also show in" (multi-gallery) control. */
  paintingSections: boolean
  /** settings.tagline / commission_intro / contact_intro → the "Site copy" editor. */
  siteCopy: boolean
  /** events status CHECK allows 'current' → the manual "Current show" status. */
  eventCurrentStatus: boolean
  /** settings/bio/sections/events focal_x/focal_y columns → the focal point picker. */
  focalPoints: boolean
  /** settings.active_layout → the "make this the site layout" control. */
  activeLayout: boolean
}

/** Shown when an action hits schema that isn't migrated yet. Friendly, not scary. */
export const SCHEMA_SETUP_MESSAGE =
  "This feature needs a quick one-time setup that hasn't run yet — everything else works normally."

const SCHEMA_ERR_CODES = new Set([
  "42P01", // undefined_table
  "42703", // undefined_column
  "23514", // check_violation
  "PGRST205", // table not in schema cache
  "PGRST204", // column not in schema cache
])

/** True if an error is caused by a not-yet-applied migration (missing table/column/constraint). */
export function isSchemaSetupError(e: unknown): boolean {
  const code = (e as { code?: string } | null)?.code
  if (code && SCHEMA_ERR_CODES.has(code)) return true
  const msg = (e instanceof Error ? e.message : String(e ?? "")).toLowerCase()
  return /does not exist|could not find the table|schema cache|violates check constraint/.test(
    msg
  )
}

async function db() {
  return isAuthBypassed() ? createAdminClient() : await createServerClient()
}

/**
 * Probe the live schema cheaply (two 1-row selects). A missing table/column comes
 * back as an error (never throws), so we treat "no error" as "capability present".
 */
export async function getSchemaCapabilities(): Promise<SchemaCapabilities> {
  try {
    const supabase = await db()
    const [ps, sc, fp, al] = await Promise.all([
      supabase.from("painting_sections").select("painting_id").limit(1),
      supabase.from("settings").select("tagline").limit(1),
      supabase.from("settings").select("home_hero_focal_x").limit(1),
      supabase.from("settings").select("active_layout").limit(1),
    ])
    const paintingSections = !ps.error
    const siteCopy = !sc.error
    const focalPoints = !fp.error
    const activeLayout = !al.error
    return {
      paintingSections,
      siteCopy,
      // The 'current' event status ships in the same one-shot migration block as
      // painting_sections, so use that as the signal (avoids an INSERT probe).
      eventCurrentStatus: paintingSections,
      focalPoints,
      activeLayout,
    }
  } catch {
    return {
      paintingSections: false,
      siteCopy: false,
      eventCurrentStatus: false,
      focalPoints: false,
      activeLayout: false,
    }
  }
}
