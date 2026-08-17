"use server"

import { revalidatePath } from "next/cache"
import { isAuthBypassed, getUser } from "@/lib/supabase/auth"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { EventWriteSchema, type EventWriteInput } from "@/lib/schemas"
import { isSchemaSetupError } from "@/lib/schema-capabilities"

const CURRENT_STATUS_SETUP_MESSAGE =
  'The "Current show" status needs a quick one-time setup that hasn\'t run yet. Use Upcoming for now — a show is shown as "On View Now" automatically while today falls within its dates.'

async function db() {
  return isAuthBypassed() ? createAdminClient() : await createServerClient()
}

function revalidateEvents() {
  revalidatePath("/events")
  revalidatePath("/admin/events")
  revalidatePath("/")
}

export async function createEvent(input: EventWriteInput) {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  const parsed = EventWriteSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  try {
    const supabase = await db()
    let { data, error } = await supabase
      .from("events")
      .insert(parsed.data)
      .select("id")
      .single()
    if (error && isSchemaSetupError(error)) {
      const { image_focal_x: _fx, image_focal_y: _fy, ...withoutFocal } = parsed.data
      void _fx
      void _fy
      ;({ data, error } = await supabase
        .from("events")
        .insert(withoutFocal)
        .select("id")
        .single())
    }
    if (error || !data) throw error ?? new Error("Failed to create event")
    revalidateEvents()
    return { ok: true, data: { id: data.id } }
  } catch (e) {
    if (isSchemaSetupError(e)) return { ok: false, error: CURRENT_STATUS_SETUP_MESSAGE }
    const message = e instanceof Error ? e.message : "Failed to create event"
    return { ok: false, error: message }
  }
}

export async function updateEvent(id: string, input: EventWriteInput) {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  const parsed = EventWriteSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  try {
    const supabase = await db()
    let { error } = await supabase
      .from("events")
      .update(parsed.data)
      .eq("id", id)
    if (error && isSchemaSetupError(error)) {
      const { image_focal_x: _fx, image_focal_y: _fy, ...withoutFocal } = parsed.data
      void _fx
      void _fy
      ;({ error } = await supabase.from("events").update(withoutFocal).eq("id", id))
    }
    if (error) throw error
    revalidateEvents()
    return { ok: true }
  } catch (e) {
    if (isSchemaSetupError(e)) return { ok: false, error: CURRENT_STATUS_SETUP_MESSAGE }
    const message = e instanceof Error ? e.message : "Failed to update event"
    return { ok: false, error: message }
  }
}

export async function deleteEvent(id: string) {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  try {
    const supabase = await db()
    const { error } = await supabase.from("events").delete().eq("id", id)
    if (error) throw error
    revalidateEvents()
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete event"
    return { ok: false, error: message }
  }
}
