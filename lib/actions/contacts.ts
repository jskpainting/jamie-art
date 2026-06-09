"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getUser } from "@/lib/supabase/auth"
import {
  ContactWriteSchema,
  ContactImportRowSchema,
  type ContactImportRow,
} from "@/lib/schemas"

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
    const supabase = await createClient()
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

  const parsed = ContactWriteSchema.partial().safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  try {
    const supabase = await createClient()
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
    const supabase = await createClient()
    const { error } = await supabase.from("contacts").delete().eq("id", id)
    if (error) throw error
    revalidateContacts()
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete contact"
    return { ok: false, error: message }
  }
}

export async function importContacts(rows: ContactImportRow[]) {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  const validRows: ContactImportRow[] = []
  for (const row of rows) {
    const parsed = ContactImportRowSchema.safeParse(row)
    if (parsed.success) validRows.push(parsed.data)
  }

  if (validRows.length === 0) {
    return { ok: false, error: "No valid rows to import" }
  }

  try {
    const supabase = await createClient()
    const inserts = validRows.map((r) => ({
      email: r.email,
      first_name: r.first_name ?? null,
      last_name: r.last_name ?? null,
      source: "csv",
    }))

    const { data, error } = await supabase
      .from("contacts")
      .upsert(inserts, { onConflict: "email", ignoreDuplicates: true })
      .select("id")

    if (error) throw error

    const inserted = data?.length ?? 0
    const skipped = validRows.length - inserted
    revalidateContacts()
    return { ok: true, data: { inserted, skipped } }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to import contacts"
    return { ok: false, error: message }
  }
}

export async function bulkUnsubscribe(ids: string[]) {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  try {
    const supabase = await createClient()
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
