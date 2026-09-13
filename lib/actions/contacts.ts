"use server"

import { revalidatePath } from "next/cache"
import { isAuthBypassed } from "@/lib/supabase/auth"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getUser } from "@/lib/supabase/auth"
import { getSchemaCapabilities } from "@/lib/schema-capabilities"
import {
  ContactWriteSchema,
  ContactUpdateSchema,
  ContactImportRowExtendedSchema,
  type ContactImportRow,
  type ContactImportRowExtended,
} from "@/lib/schemas"
import { logActivity } from "@/lib/actions/crm"

async function db() {
  return isAuthBypassed() ? createAdminClient() : await createServerClient()
}

function revalidateContacts() {
  revalidatePath("/admin/contacts")
}

export async function createContact(input: unknown) {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  const parsed = ContactWriteSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  try {
    const supabase = await db()
    const { data, error } = await supabase
      .from("contacts")
      .insert(parsed.data)
      .select("id")
      .single()
    if (error) throw error
    revalidateContacts()
    return { ok: true, data: { id: data.id } }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create contact"
    return { ok: false, error: message }
  }
}

export async function updateContact(id: string, input: unknown) {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  const parsed = ContactUpdateSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  try {
    const supabase = await db()
    const { error } = await supabase
      .from("contacts")
      .update(parsed.data)
      .eq("id", id)
    if (error) throw error
    revalidateContacts()
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update contact"
    return { ok: false, error: message }
  }
}

export async function deleteContact(id: string) {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  try {
    const supabase = await db()
    const { error } = await supabase.from("contacts").delete().eq("id", id)
    if (error) throw error
    revalidateContacts()
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete contact"
    return { ok: false, error: message }
  }
}

function splitTags(raw: string | undefined): string[] {
  if (!raw) return []
  return raw
    .split(/[;,]/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
}

/**
 * Accepts the extended row shape (phone, city, tags, group, notes) but the
 * old 3-column CSV (email, first_name, last_name) still works unchanged —
 * every added field is optional. An existing email only has its BLANK
 * fields filled in; nothing already set is ever overwritten. New rows get
 * `source: "csv"` and an `import` timeline entry.
 */
export async function importContacts(rows: (ContactImportRow | ContactImportRowExtended)[]) {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  const validRows: ContactImportRowExtended[] = []
  for (const row of rows) {
    const parsed = ContactImportRowExtendedSchema.safeParse(row)
    if (parsed.success) validRows.push(parsed.data)
  }

  if (validRows.length === 0) {
    return { ok: false, error: "No valid rows to import" }
  }

  try {
    const supabase = await db()
    const { crm } = await getSchemaCapabilities()

    // Group names -> ids, created on demand (only meaningful once `crm` is live).
    const groupIds = new Map<string, string>()
    if (crm) {
      const wantedGroups = [...new Set(validRows.map((r) => r.group?.trim()).filter(Boolean))] as string[]
      for (const name of wantedGroups) {
        const { data: existingGroup } = await supabase
          .from("contact_groups")
          .select("id")
          .eq("name", name)
          .maybeSingle()
        if (existingGroup) {
          groupIds.set(name, existingGroup.id as string)
          continue
        }
        const { data: created, error: createError } = await supabase
          .from("contact_groups")
          .insert({ name })
          .select("id")
          .single()
        if (!createError && created) groupIds.set(name, created.id as string)
      }
    }

    let inserted = 0
    let updated = 0

    for (const row of validRows) {
      const email = row.email.trim().toLowerCase()
      const tags = splitTags(row.tags)

      const { data: existing } = await supabase
        .from("contacts")
        .select("*")
        .eq("email", email)
        .maybeSingle()

      let contactId: string

      if (existing) {
        // Only fill fields that are currently blank — never overwrite.
        const patch: Record<string, unknown> = {}
        if (!existing.first_name && row.first_name) patch.first_name = row.first_name
        if (!existing.last_name && row.last_name) patch.last_name = row.last_name
        if (crm) {
          if (!existing.phone && row.phone) patch.phone = row.phone
          if (!existing.city && row.city) patch.city = row.city
          if (!existing.notes && row.notes) patch.notes = row.notes
        }
        if (tags.length > 0) {
          const merged = new Set([...(existing.tags as string[] | null ?? []), ...tags])
          patch.tags = [...merged]
        }

        if (Object.keys(patch).length > 0) {
          if (crm) patch.updated_at = new Date().toISOString()
          const { error } = await supabase.from("contacts").update(patch).eq("id", existing.id)
          if (error) throw error
        }
        contactId = existing.id as string
        updated += 1
      } else {
        const insertRow: Record<string, unknown> = {
          email,
          first_name: row.first_name ?? null,
          last_name: row.last_name ?? null,
          source: "csv",
          tags,
        }
        if (crm) {
          insertRow.phone = row.phone ?? null
          insertRow.city = row.city ?? null
          insertRow.notes = row.notes ?? null
        }
        const { data: created, error } = await supabase
          .from("contacts")
          .insert(insertRow)
          .select("id")
          .single()
        if (error) throw error
        contactId = created.id as string
        inserted += 1
      }

      if (crm) {
        const groupName = row.group?.trim()
        const groupId = groupName ? groupIds.get(groupName) : undefined
        if (groupId) {
          await supabase
            .from("contact_group_members")
            .upsert(
              { contact_id: contactId, group_id: groupId },
              { onConflict: "contact_id,group_id", ignoreDuplicates: true }
            )
        }
        await logActivity(contactId, "import", "Imported from CSV")
      }
    }

    revalidateContacts()
    return { ok: true, data: { inserted, skipped: updated } }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to import contacts"
    return { ok: false, error: message }
  }
}

export async function bulkUnsubscribe(ids: string[]) {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  try {
    const supabase = await db()
    const { error } = await supabase
      .from("contacts")
      .update({ subscribed: false })
      .in("id", ids)
    if (error) throw error
    revalidateContacts()
    return { ok: true }
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to bulk unsubscribe"
    return { ok: false, error: message }
  }
}
