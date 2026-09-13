"use server"

import { revalidatePath } from "next/cache"
import { isAuthBypassed, getUser } from "@/lib/supabase/auth"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isSchemaSetupError, SCHEMA_SETUP_MESSAGE } from "@/lib/schema-capabilities"
import {
  RsvpRespondByTokenSchema,
  RsvpRespondPublicSchema,
  RsvpStatusSchema,
} from "@/lib/schemas"
import { logActivity, findOrCreateContact } from "@/lib/actions/crm"

async function db() {
  return isAuthBypassed() ? createAdminClient() : await createServerClient()
}

function revalidateEvent(eventId: string) {
  revalidatePath("/admin/events")
  revalidatePath(`/admin/events/${eventId}/rsvps`)
  revalidatePath("/admin/contacts")
}

// ---------------------------------------------------------------------------
// Admin (getUser()-guarded)
// ---------------------------------------------------------------------------

export async function getEventRsvps(eventId: string) {
  const user = await getUser()
  if (!user) return { ok: false as const, error: "Unauthorized" }

  try {
    const supabase = await db()
    const { data, error } = await supabase
      .from("event_rsvps")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })
    if (error) {
      if (isSchemaSetupError(error)) return { ok: true as const, rsvps: [] }
      throw error
    }
    return { ok: true as const, rsvps: data ?? [] }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load RSVPs"
    return { ok: false as const, error: message }
  }
}

export async function setRsvpStatus(id: string, status: string) {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  const parsed = RsvpStatusSchema.safeParse(status)
  if (!parsed.success) return { ok: false, error: "Invalid status" }

  try {
    const supabase = await db()
    const { data, error } = await supabase
      .from("event_rsvps")
      .update({ status: parsed.data, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("event_id, contact_id")
      .single()
    if (error) {
      if (isSchemaSetupError(error)) return { ok: false, error: SCHEMA_SETUP_MESSAGE }
      throw error
    }

    if (data.contact_id) {
      await logActivity(data.contact_id as string, "rsvp", `RSVP set to "${parsed.data}" by admin`, id)
    }

    revalidateEvent(data.event_id as string)
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update RSVP"
    return { ok: false, error: message }
  }
}

export async function deleteRsvp(id: string) {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  try {
    const supabase = await db()
    const { data: existing } = await supabase
      .from("event_rsvps")
      .select("event_id")
      .eq("id", id)
      .maybeSingle()

    const { error } = await supabase.from("event_rsvps").delete().eq("id", id)
    if (error) {
      if (isSchemaSetupError(error)) return { ok: false, error: SCHEMA_SETUP_MESSAGE }
      throw error
    }

    if (existing) revalidateEvent(existing.event_id as string)
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete RSVP"
    return { ok: false, error: message }
  }
}

/**
 * Upserts an `invited` row per contact for an event and returns the token to
 * build each person's RSVP link with (`${SITE_URL}/rsvp/${eventId}?t=${token}`).
 * Used by the newsletter "invite everyone" flow (agent O).
 */
export async function createInvites(
  eventId: string,
  contactIds: string[]
): Promise<
  | { ok: true; invites: { contactId: string; token: string }[] }
  | { ok: false; error: string }
> {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }
  if (contactIds.length === 0) return { ok: true, invites: [] }

  try {
    const supabase = await db()
    const { data: contacts, error: contactsError } = await supabase
      .from("contacts")
      .select("id, email, first_name, last_name")
      .in("id", contactIds)
    if (contactsError) throw contactsError

    const invites: { contactId: string; token: string }[] = []

    for (const contact of contacts ?? []) {
      const name = [contact.first_name, contact.last_name].filter(Boolean).join(" ") || null
      const { data: existing } = await supabase
        .from("event_rsvps")
        .select("id, token, status")
        .eq("event_id", eventId)
        .eq("email", contact.email as string)
        .maybeSingle()

      if (existing) {
        invites.push({ contactId: contact.id as string, token: existing.token as string })
        continue
      }

      const { data, error } = await supabase
        .from("event_rsvps")
        .insert({
          event_id: eventId,
          contact_id: contact.id,
          email: contact.email,
          name,
          status: "invited",
          source: "email",
        })
        .select("token")
        .single()
      if (error) {
        if (isSchemaSetupError(error)) return { ok: false, error: SCHEMA_SETUP_MESSAGE }
        throw error
      }
      invites.push({ contactId: contact.id as string, token: data.token as string })
    }

    revalidateEvent(eventId)
    return { ok: true, invites }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create invites"
    return { ok: false, error: message }
  }
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

export async function exportRsvpsCsv(
  eventId: string
): Promise<{ ok: true; csv: string } | { ok: false; error: string }> {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  try {
    const supabase = await db()
    const { data, error } = await supabase
      .from("event_rsvps")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })
    if (error) {
      if (isSchemaSetupError(error)) return { ok: true, csv: "name,email,status,guests,source,created_at\n" }
      throw error
    }

    const header = "name,email,status,guests,source,created_at"
    const rows = (data ?? []).map((r) =>
      [
        csvEscape((r.name as string) ?? ""),
        csvEscape(r.email as string),
        r.status as string,
        String(r.guests as number),
        r.source as string,
        r.created_at as string,
      ].join(",")
    )
    return { ok: true, csv: [header, ...rows].join("\n") }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to export RSVPs"
    return { ok: false, error: message }
  }
}

// ---------------------------------------------------------------------------
// Public (NOT getUser()-guarded).
//
// These two functions are meant to be called ONLY from the `POST /api/rsvp`
// route handler that agent N writes (Zod validation there is a second layer
// on top of the schemas re-checked here; the route also applies the IP rate
// limit via lib/rate-limit.ts and a honeypot field). Do not call them from
// any authenticated admin surface — use the admin functions above instead.
// ---------------------------------------------------------------------------

async function getEventForRsvpCheck(eventId: string) {
  const supabase = createAdminClient()
  const { data: event, error } = await supabase
    .from("events")
    .select("id, status, starts_at, rsvp_enabled, rsvp_limit")
    .eq("id", eventId)
    .maybeSingle()
  if (error || !event) return null
  return event
}

async function countYes(eventId: string, supabase: Awaited<ReturnType<typeof db>>) {
  const { data } = await supabase
    .from("event_rsvps")
    .select("guests")
    .eq("event_id", eventId)
    .eq("status", "yes")
  return (data ?? []).reduce((sum, r) => sum + ((r.guests as number) ?? 1), 0)
}

type PublicRsvpResult =
  | { ok: true }
  | { ok: false; reason: "full" | "past" | "disabled" | "not_found" | "invalid" }
  | { ok: false; error: string }

/** Answering via an emailed invite link — no name/email needed. */
export async function respondByToken(token: string, input: unknown): Promise<PublicRsvpResult> {
  const parsed = RsvpRespondByTokenSchema.safeParse({ token, ...(input as object) })
  if (!parsed.success) return { ok: false, reason: "invalid" }

  try {
    const supabase = createAdminClient()
    const { data: rsvp, error: lookupError } = await supabase
      .from("event_rsvps")
      .select("id, event_id, contact_id, status, guests")
      .eq("token", parsed.data.token)
      .maybeSingle()
    if (lookupError) {
      if (isSchemaSetupError(lookupError)) return { ok: false, error: SCHEMA_SETUP_MESSAGE }
      throw lookupError
    }
    if (!rsvp) return { ok: false, reason: "not_found" }

    const event = await getEventForRsvpCheck(rsvp.event_id as string)
    if (!event) return { ok: false, reason: "not_found" }
    if (!event.rsvp_enabled) return { ok: false, reason: "disabled" }
    if (event.status === "past" || event.status === "cancelled") return { ok: false, reason: "past" }

    if (
      parsed.data.status === "yes" &&
      rsvp.status !== "yes" &&
      event.rsvp_limit != null
    ) {
      const currentYes = await countYes(rsvp.event_id as string, supabase)
      if (currentYes + parsed.data.guests > event.rsvp_limit) {
        return { ok: false, reason: "full" }
      }
    }

    const { error } = await supabase
      .from("event_rsvps")
      .update({
        status: parsed.data.status,
        guests: parsed.data.guests,
        note: parsed.data.note ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", rsvp.id)
    if (error) throw error

    if (rsvp.contact_id) {
      await logActivity(
        rsvp.contact_id as string,
        "rsvp",
        `RSVP'd "${parsed.data.status}" via invite link`,
        rsvp.id as string
      )
    }

    revalidateEvent(rsvp.event_id as string)
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to record RSVP"
    return { ok: false, error: message }
  }
}

/** Answering from the public event page with no invite — upserts by (event_id, email). */
export async function respondPublic(eventId: string, input: unknown): Promise<PublicRsvpResult> {
  const parsed = RsvpRespondPublicSchema.safeParse({ eventId, ...(input as object) })
  if (!parsed.success) return { ok: false, reason: "invalid" }
  // Honeypot filled → pretend success, write nothing.
  if (parsed.data.website) return { ok: true }

  try {
    const event = await getEventForRsvpCheck(eventId)
    if (!event) return { ok: false, reason: "not_found" }
    if (!event.rsvp_enabled) return { ok: false, reason: "disabled" }
    if (event.status === "past" || event.status === "cancelled") return { ok: false, reason: "past" }

    const supabase = createAdminClient()
    const email = parsed.data.email.trim().toLowerCase()

    if (parsed.data.status === "yes" && event.rsvp_limit != null) {
      const { data: existingRow } = await supabase
        .from("event_rsvps")
        .select("guests, status")
        .eq("event_id", eventId)
        .eq("email", email)
        .maybeSingle()
      const currentYes = await countYes(eventId, supabase)
      const previousGuests =
        existingRow && existingRow.status === "yes" ? (existingRow.guests as number) : 0
      if (currentYes - previousGuests + parsed.data.guests > event.rsvp_limit) {
        return { ok: false, reason: "full" }
      }
    }

    const found = await findOrCreateContact({
      email,
      first_name: parsed.data.name.split(" ")[0] || parsed.data.name,
      source: "rsvp",
      subscribed: parsed.data.keepMePosted,
    })
    if (!found.ok) return { ok: false, error: found.error }

    // Keep an existing contact's subscribed flag unless they explicitly opted in now.
    if (!found.created && parsed.data.keepMePosted) {
      await supabase
        .from("contacts")
        .update({ subscribed: true })
        .eq("id", found.id)
        .eq("subscribed", false)
    }

    const { data, error } = await supabase
      .from("event_rsvps")
      .upsert(
        {
          event_id: eventId,
          contact_id: found.id,
          email,
          name: parsed.data.name,
          status: parsed.data.status,
          guests: parsed.data.guests,
          note: parsed.data.note ?? null,
          source: "site",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "event_id,email" }
      )
      .select("id")
      .single()
    if (error) throw error

    await logActivity(found.id, "rsvp", `RSVP'd "${parsed.data.status}" on the website`, data.id as string)

    revalidateEvent(eventId)
    revalidatePath(`/rsvp/${eventId}`)
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to record RSVP"
    return { ok: false, error: message }
  }
}

// Note: no `export type { RsvpStatus }` here — a bare type re-export from a
// "use server" file confuses Next's server-actions compiler (it tries to
// proxy every export as a callable action, including type-only ones, and
// fails at runtime with "Export RsvpStatus doesn't exist"). Import RsvpStatus
// from "@/lib/types" directly instead.
