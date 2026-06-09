"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getUser } from "@/lib/supabase/auth"
import { EventWriteSchema, type EventWriteInput } from "@/lib/schemas"

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
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("events")
      .insert(parsed.data)
      .select("id")
      .single()
    if (error) throw error
    revalidateEvents()
    return { ok: true, data: { id: data.id } }
  } catch (e) {
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
    const supabase = await createClient()
    const { error } = await supabase
      .from("events")
      .update(parsed.data)
      .eq("id", id)
    if (error) throw error
    revalidateEvents()
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update event"
    return { ok: false, error: message }
  }
}

export async function deleteEvent(id: string) {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  try {
    const supabase = await createClient()
    const { error } = await supabase.from("events").delete().eq("id", id)
    if (error) throw error
    revalidateEvents()
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete event"
    return { ok: false, error: message }
  }
}
