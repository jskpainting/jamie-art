"use server"

import { revalidatePath } from "next/cache"
import { isAuthBypassed, getUser } from "@/lib/supabase/auth"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isSchemaSetupError, SCHEMA_SETUP_MESSAGE } from "@/lib/schema-capabilities"
import {
  GroupWriteSchema,
  PurchaseWriteSchema,
  NoteSchema,
  AudienceSchema,
  ContactDetailsUpdateSchema,
  TagNameSchema,
  type AudienceInput,
} from "@/lib/schemas"
import type { ActivityKind } from "@/lib/types"

async function db() {
  return isAuthBypassed() ? createAdminClient() : await createServerClient()
}

function revalidateContacts(id?: string) {
  revalidatePath("/admin/contacts")
  if (id) revalidatePath(`/admin/contacts/${id}`)
}

/**
 * Writes one row to the contact timeline. Called by every write below and by
 * lib/actions/rsvp.ts, app/api/newsletter/route.ts, app/api/inquiries/route.ts
 * and lib/actions/commission.ts. Never throws — a broken timeline write must
 * never break the action that triggered it (a purchase saving, a public form
 * submitting, a newsletter sending).
 */
export async function logActivity(
  contactId: string,
  kind: ActivityKind,
  summary: string,
  refId?: string | null
): Promise<void> {
  try {
    // Always the admin client: this runs from public routes (RSVP, signup,
    // enquiries) where there is no signed-in user, and only writes system rows.
    const supabase = createAdminClient()
    const { error } = await supabase.from("contact_activities").insert({
      contact_id: contactId,
      kind,
      summary,
      ref_id: refId ?? null,
    })
    if (error && !isSchemaSetupError(error)) {
      console.error("logActivity error:", error)
    }
  } catch (e) {
    console.error("logActivity error:", e)
  }
}

/**
 * Finds a contact by email, or creates one. Used by the "Sold to" flow, the
 * public RSVP responders, and the newsletter/inquiry/commission hooks.
 * Never overwrites an existing contact's `subscribed` flag — callers that
 * want to (re)subscribe someone pass `subscribed` only for a brand-new row.
 *
 * NOT getUser()-guarded (called from public forms), but it only ever
 * inserts/reads a contact by a validated email — no destructive or
 * privileged action — so this is safe to call from public server actions
 * and route handlers.
 */
export async function findOrCreateContact(input: {
  email: string
  first_name?: string | null
  last_name?: string | null
  source: string
  subscribed?: boolean
}): Promise<{ ok: true; id: string; created: boolean } | { ok: false; error: string }> {
  try {
    // Admin client for the same reason as logActivity — public callers have
    // no session, and RLS would refuse the insert.
    const supabase = createAdminClient()
    const email = input.email.trim().toLowerCase()

    const { data: existing, error: lookupError } = await supabase
      .from("contacts")
      .select("id")
      .eq("email", email)
      .maybeSingle()
    if (lookupError) throw lookupError

    if (existing) {
      return { ok: true, id: existing.id as string, created: false }
    }

    const { data, error } = await supabase
      .from("contacts")
      .insert({
        email,
        first_name: input.first_name ?? null,
        last_name: input.last_name ?? null,
        source: input.source,
        subscribed: input.subscribed ?? false,
      })
      .select("id")
      .single()

    // 23505 = created by a concurrent request — treat as found, not a failure.
    if (error) {
      if ((error as { code?: string }).code === "23505") {
        const { data: found } = await supabase
          .from("contacts")
          .select("id")
          .eq("email", email)
          .maybeSingle()
        if (found) return { ok: true, id: found.id as string, created: false }
      }
      throw error
    }

    return { ok: true, id: data.id as string, created: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to find or create contact"
    return { ok: false, error: message }
  }
}

// --- Groups ----------------------------------------------------------------

export async function getGroups() {
  const user = await getUser()
  if (!user) return { ok: false as const, error: "Unauthorized" }

  try {
    const supabase = await db()
    const { data: groups, error } = await supabase
      .from("contact_groups")
      .select("*")
      .order("name")
    if (error) {
      if (isSchemaSetupError(error)) return { ok: true as const, groups: [] }
      throw error
    }

    const { data: members, error: membersError } = await supabase
      .from("contact_group_members")
      .select("group_id")
    if (membersError) throw membersError

    const counts = new Map<string, number>()
    for (const m of members ?? []) {
      const gid = m.group_id as string
      counts.set(gid, (counts.get(gid) ?? 0) + 1)
    }

    return {
      ok: true as const,
      groups: (groups ?? []).map((g) => ({ ...g, member_count: counts.get(g.id as string) ?? 0 })),
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load groups"
    return { ok: false as const, error: message }
  }
}

export async function createGroup(name: string, description?: string | null) {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  const parsed = GroupWriteSchema.safeParse({ name, description })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  try {
    const supabase = await db()
    const { data, error } = await supabase
      .from("contact_groups")
      .insert({ name: parsed.data.name, description: parsed.data.description ?? null })
      .select("id, name")
      .single()
    if (error) {
      if (isSchemaSetupError(error)) return { ok: false, error: SCHEMA_SETUP_MESSAGE }
      if ((error as { code?: string }).code === "23505") {
        return { ok: false, error: "A group with that name already exists" }
      }
      throw error
    }
    revalidateContacts()
    return { ok: true, data: { id: data.id as string, name: data.name as string } }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create group"
    return { ok: false, error: message }
  }
}

export async function renameGroup(id: string, name: string) {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  const parsed = GroupWriteSchema.shape.name.safeParse(name)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  try {
    const supabase = await db()
    const { error } = await supabase
      .from("contact_groups")
      .update({ name: parsed.data })
      .eq("id", id)
    if (error) {
      if (isSchemaSetupError(error)) return { ok: false, error: SCHEMA_SETUP_MESSAGE }
      if ((error as { code?: string }).code === "23505") {
        return { ok: false, error: "A group with that name already exists" }
      }
      throw error
    }
    revalidateContacts()
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to rename group"
    return { ok: false, error: message }
  }
}

export async function deleteGroup(id: string) {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  try {
    const supabase = await db()
    const { error } = await supabase.from("contact_groups").delete().eq("id", id)
    if (error) {
      if (isSchemaSetupError(error)) return { ok: false, error: SCHEMA_SETUP_MESSAGE }
      throw error
    }
    revalidateContacts()
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete group"
    return { ok: false, error: message }
  }
}

export async function setContactGroups(contactId: string, groupIds: string[]) {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  try {
    const supabase = await db()
    const { data: existing, error: fetchError } = await supabase
      .from("contact_group_members")
      .select("group_id")
      .eq("contact_id", contactId)
    if (fetchError) {
      if (isSchemaSetupError(fetchError)) return { ok: false, error: SCHEMA_SETUP_MESSAGE }
      throw fetchError
    }

    const existingIds = new Set((existing ?? []).map((r) => r.group_id as string))
    const desiredIds = new Set(groupIds)

    const toDelete = [...existingIds].filter((id) => !desiredIds.has(id))
    if (toDelete.length > 0) {
      const { error } = await supabase
        .from("contact_group_members")
        .delete()
        .eq("contact_id", contactId)
        .in("group_id", toDelete)
      if (error) throw error
    }

    const toInsert = groupIds.filter((id) => !existingIds.has(id))
    if (toInsert.length > 0) {
      const { error } = await supabase
        .from("contact_group_members")
        .insert(toInsert.map((group_id) => ({ contact_id: contactId, group_id })))
      if (error) throw error

      const { data: groups } = await supabase
        .from("contact_groups")
        .select("name")
        .in("id", toInsert)
      for (const g of groups ?? []) {
        await logActivity(contactId, "group", `Added to group "${g.name}"`)
      }
    }

    revalidateContacts(contactId)
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update groups"
    return { ok: false, error: message }
  }
}

export async function bulkAddToGroup(contactIds: string[], groupId: string) {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }
  if (contactIds.length === 0) return { ok: true }

  try {
    const supabase = await db()
    const { error } = await supabase
      .from("contact_group_members")
      .upsert(
        contactIds.map((contact_id) => ({ contact_id, group_id: groupId })),
        { onConflict: "contact_id,group_id", ignoreDuplicates: true }
      )
    if (error) {
      if (isSchemaSetupError(error)) return { ok: false, error: SCHEMA_SETUP_MESSAGE }
      throw error
    }

    const { data: group } = await supabase
      .from("contact_groups")
      .select("name")
      .eq("id", groupId)
      .maybeSingle()
    for (const contactId of contactIds) {
      await logActivity(contactId, "group", `Added to group "${group?.name ?? ""}"`.trim())
    }

    revalidateContacts()
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to add to group"
    return { ok: false, error: message }
  }
}

export async function bulkRemoveFromGroup(contactIds: string[], groupId: string) {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }
  if (contactIds.length === 0) return { ok: true }

  try {
    const supabase = await db()
    const { error } = await supabase
      .from("contact_group_members")
      .delete()
      .eq("group_id", groupId)
      .in("contact_id", contactIds)
    if (error) {
      if (isSchemaSetupError(error)) return { ok: false, error: SCHEMA_SETUP_MESSAGE }
      throw error
    }
    revalidateContacts()
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to remove from group"
    return { ok: false, error: message }
  }
}

// --- Tags (contacts.tags text[]) -------------------------------------------

export async function getContactTags() {
  const user = await getUser()
  if (!user) return { ok: false as const, error: "Unauthorized" }

  try {
    const supabase = await db()
    const { data, error } = await supabase.from("contacts").select("tags")
    if (error) throw error

    const counts = new Map<string, number>()
    for (const row of data ?? []) {
      for (const tag of (row.tags as string[] | null) ?? []) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1)
      }
    }
    return {
      ok: true as const,
      tags: [...counts.entries()]
        .map(([name, inUse]) => ({ name, inUse }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load tags"
    return { ok: false as const, error: message }
  }
}

export async function bulkAddTag(contactIds: string[], tag: string) {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }
  const parsed = TagNameSchema.safeParse(tag)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  if (contactIds.length === 0) return { ok: true }

  try {
    const supabase = await db()
    const { data: rows, error: fetchError } = await supabase
      .from("contacts")
      .select("id, tags")
      .in("id", contactIds)
    if (fetchError) throw fetchError

    for (const row of rows ?? []) {
      const tags = new Set((row.tags as string[] | null) ?? [])
      if (tags.has(parsed.data)) continue
      tags.add(parsed.data)
      const { error } = await supabase
        .from("contacts")
        .update({ tags: [...tags] })
        .eq("id", row.id as string)
      if (error) throw error
      await logActivity(row.id as string, "tag", `Tagged "${parsed.data}"`)
    }

    revalidateContacts()
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to add tag"
    return { ok: false, error: message }
  }
}

export async function bulkRemoveTag(contactIds: string[], tag: string) {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }
  if (contactIds.length === 0) return { ok: true }

  try {
    const supabase = await db()
    const { data: rows, error: fetchError } = await supabase
      .from("contacts")
      .select("id, tags")
      .in("id", contactIds)
    if (fetchError) throw fetchError

    for (const row of rows ?? []) {
      const tags = ((row.tags as string[] | null) ?? []).filter((t) => t !== tag)
      const { error } = await supabase
        .from("contacts")
        .update({ tags })
        .eq("id", row.id as string)
      if (error) throw error
    }

    revalidateContacts()
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to remove tag"
    return { ok: false, error: message }
  }
}

export async function renameTag(oldName: string, newName: string) {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }
  const parsed = TagNameSchema.safeParse(newName)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  try {
    const supabase = await db()
    const { data: rows, error: fetchError } = await supabase
      .from("contacts")
      .select("id, tags")
      .contains("tags", [oldName])
    if (fetchError) throw fetchError

    for (const row of rows ?? []) {
      const tags = new Set((row.tags as string[] | null) ?? [])
      tags.delete(oldName)
      tags.add(parsed.data)
      const { error } = await supabase
        .from("contacts")
        .update({ tags: [...tags] })
        .eq("id", row.id as string)
      if (error) throw error
    }

    revalidateContacts()
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to rename tag"
    return { ok: false, error: message }
  }
}

export async function deleteTag(tag: string) {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  try {
    const supabase = await db()
    const { data: rows, error: fetchError } = await supabase
      .from("contacts")
      .select("id, tags")
      .contains("tags", [tag])
    if (fetchError) throw fetchError

    for (const row of rows ?? []) {
      const tags = ((row.tags as string[] | null) ?? []).filter((t) => t !== tag)
      const { error } = await supabase
        .from("contacts")
        .update({ tags })
        .eq("id", row.id as string)
      if (error) throw error
    }

    revalidateContacts()
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete tag"
    return { ok: false, error: message }
  }
}

// --- Contact details ---------------------------------------------------------

export async function updateContactDetails(id: string, input: unknown) {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  const parsed = ContactDetailsUpdateSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  try {
    const supabase = await db()
    const { error } = await supabase
      .from("contacts")
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq("id", id)
    if (error) {
      if (isSchemaSetupError(error)) return { ok: false, error: SCHEMA_SETUP_MESSAGE }
      throw error
    }
    revalidateContacts(id)
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update contact"
    return { ok: false, error: message }
  }
}

// --- Purchases ---------------------------------------------------------------

export async function addPurchase(contactId: string, input: unknown) {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  const parsed = PurchaseWriteSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  try {
    const supabase = await db()
    let title = parsed.data.title ?? null
    let price_cents = parsed.data.price_cents ?? null

    if (parsed.data.painting_id && (!title || price_cents == null)) {
      const { data: painting } = await supabase
        .from("paintings")
        .select("title, price_cents")
        .eq("id", parsed.data.painting_id)
        .maybeSingle()
      if (painting) {
        title = title ?? (painting.title as string)
        price_cents = price_cents ?? (painting.price_cents as number | null)
      }
    }

    const { data, error } = await supabase
      .from("purchases")
      .insert({
        contact_id: contactId,
        painting_id: parsed.data.painting_id ?? null,
        title,
        price_cents,
        purchased_on: parsed.data.purchased_on ?? null,
        notes: parsed.data.notes ?? null,
      })
      .select("id")
      .single()
    if (error) {
      if (isSchemaSetupError(error)) return { ok: false, error: SCHEMA_SETUP_MESSAGE }
      throw error
    }

    if (parsed.data.markSold && parsed.data.painting_id) {
      await supabase
        .from("paintings")
        .update({ status: "sold", sold_at: new Date().toISOString() })
        .eq("id", parsed.data.painting_id)
    }

    await logActivity(
      contactId,
      "purchase",
      title ? `Purchased "${title}"` : "Recorded a purchase",
      data.id as string
    )

    revalidateContacts(contactId)
    revalidatePath("/admin/portfolio", "layout")
    return { ok: true, data: { id: data.id as string } }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to add purchase"
    return { ok: false, error: message }
  }
}

export async function updatePurchase(id: string, input: unknown) {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  const parsed = PurchaseWriteSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  try {
    const supabase = await db()
    const { data: existing, error: fetchError } = await supabase
      .from("purchases")
      .select("contact_id")
      .eq("id", id)
      .single()
    if (fetchError) throw fetchError

    const { error } = await supabase
      .from("purchases")
      .update({
        painting_id: parsed.data.painting_id ?? null,
        title: parsed.data.title ?? null,
        price_cents: parsed.data.price_cents ?? null,
        purchased_on: parsed.data.purchased_on ?? null,
        notes: parsed.data.notes ?? null,
      })
      .eq("id", id)
    if (error) {
      if (isSchemaSetupError(error)) return { ok: false, error: SCHEMA_SETUP_MESSAGE }
      throw error
    }

    revalidateContacts(existing.contact_id as string)
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update purchase"
    return { ok: false, error: message }
  }
}

export async function deletePurchase(id: string) {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  try {
    const supabase = await db()
    const { data: existing } = await supabase
      .from("purchases")
      .select("contact_id")
      .eq("id", id)
      .maybeSingle()

    const { error } = await supabase.from("purchases").delete().eq("id", id)
    if (error) {
      if (isSchemaSetupError(error)) return { ok: false, error: SCHEMA_SETUP_MESSAGE }
      throw error
    }

    if (existing) revalidateContacts(existing.contact_id as string)
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete purchase"
    return { ok: false, error: message }
  }
}

// --- Activities ----------------------------------------------------------

export async function addNote(contactId: string, text: string) {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  const parsed = NoteSchema.safeParse({ text })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  try {
    const supabase = await db()
    const { error } = await supabase.from("contact_activities").insert({
      contact_id: contactId,
      kind: "note",
      summary: parsed.data.text,
    })
    if (error) {
      if (isSchemaSetupError(error)) return { ok: false, error: SCHEMA_SETUP_MESSAGE }
      throw error
    }
    revalidateContacts(contactId)
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to add note"
    return { ok: false, error: message }
  }
}

// --- Audience (newsletter targeting) ----------------------------------------

/** Resolves an audience selector to a distinct list of SUBSCRIBED contact ids. */
export async function resolveAudience(
  audience: AudienceInput
): Promise<{ ok: true; ids: string[] } | { ok: false; error: string }> {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  try {
    const supabase = await db()

    if (audience.type === "all") {
      const { data, error } = await supabase
        .from("contacts")
        .select("id")
        .eq("subscribed", true)
      if (error) throw error
      return { ok: true, ids: (data ?? []).map((r) => r.id as string) }
    }

    if (audience.type === "people") {
      const { data, error } = await supabase
        .from("contacts")
        .select("id")
        .eq("subscribed", true)
        .in("id", audience.ids)
      if (error) throw error
      return { ok: true, ids: (data ?? []).map((r) => r.id as string) }
    }

    if (audience.type === "tags") {
      if (audience.names.length === 0) return { ok: true, ids: [] }
      const { data, error } = await supabase
        .from("contacts")
        .select("id, tags")
        .eq("subscribed", true)
        .overlaps("tags", audience.names)
      if (error) throw error
      return { ok: true, ids: (data ?? []).map((r) => r.id as string) }
    }

    // groups
    if (audience.ids.length === 0) return { ok: true, ids: [] }
    const { data: members, error: membersError } = await supabase
      .from("contact_group_members")
      .select("contact_id")
      .in("group_id", audience.ids)
    if (membersError) {
      if (isSchemaSetupError(membersError)) return { ok: true, ids: [] }
      throw membersError
    }
    const contactIds = [...new Set((members ?? []).map((r) => r.contact_id as string))]
    if (contactIds.length === 0) return { ok: true, ids: [] }
    const { data, error } = await supabase
      .from("contacts")
      .select("id")
      .eq("subscribed", true)
      .in("id", contactIds)
    if (error) throw error
    return { ok: true, ids: (data ?? []).map((r) => r.id as string) }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to resolve audience"
    return { ok: false, error: message }
  }
}

/** Convenience wrapper — same as resolveAudience but only the count. */
export async function countAudience(
  audience: unknown
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  const parsed = AudienceSchema.safeParse(audience)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  const resolved = await resolveAudience(parsed.data)
  if (!resolved.ok) return resolved
  return { ok: true, count: resolved.ids.length }
}

// --- Search ------------------------------------------------------------

export interface ContactSearchResult {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
}

/**
 * Small name/email search for the "Sold to" picker on the painting dialog.
 * Returns at most 8 matches. Empty/blank query returns no results (the
 * picker shouldn't dump the whole list open).
 */
export async function searchContacts(
  q: string
): Promise<{ ok: true; results: ContactSearchResult[] } | { ok: false; error: string }> {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  const query = q.trim()
  if (query.length < 2) return { ok: true, results: [] }

  try {
    const supabase = await db()
    const { data, error } = await supabase
      .from("contacts")
      .select("id, email, first_name, last_name")
      .or(`email.ilike.%${query}%,first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
      .limit(8)
    if (error) throw error
    return { ok: true, results: (data ?? []) as ContactSearchResult[] }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to search people"
    return { ok: false, error: message }
  }
}
