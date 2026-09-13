"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { isAuthBypassed, getUser } from "@/lib/supabase/auth"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isSchemaSetupError, SCHEMA_SETUP_MESSAGE } from "@/lib/schema-capabilities"
import {
  normalizeFieldValue,
  type FieldOptionField,
} from "@/lib/field-options"

async function db() {
  return isAuthBypassed() ? createAdminClient() : await createServerClient()
}

function revalidate() {
  revalidatePath("/admin/settings")
  revalidatePath("/admin/portfolio", "layout")
}

export interface FieldOptionRow {
  value: string
  lastUsedAt: string
  inUse: number
}

export type FieldOptionsResult =
  | {
      ok: true
      source: "table" | "paintings"
      options: Record<FieldOptionField, FieldOptionRow[]>
    }
  | { ok: false; error: string }

/**
 * Count, per normalised value, how many paintings currently use it. Always
 * computed live from `paintings` (103 rows — cheap) regardless of whether the
 * `field_options` table exists, so the "used on N paintings" count is never
 * stale relative to the actual data.
 */
async function countInUse(): Promise<{
  medium: Map<string, { count: number; lastUsedAt: string }>
  dimensions: Map<string, { count: number; lastUsedAt: string }>
}> {
  const supabase = await db()
  const { data, error } = await supabase
    .from("paintings")
    .select("medium, dimensions, created_at")
  if (error) throw error

  const medium = new Map<string, { count: number; lastUsedAt: string }>()
  const dimensions = new Map<string, { count: number; lastUsedAt: string }>()

  for (const row of data ?? []) {
    const createdAt = (row as { created_at: string }).created_at
    const rawMedium = (row as { medium: string | null }).medium
    const rawDimensions = (row as { dimensions: string | null }).dimensions

    if (rawMedium && rawMedium.trim()) {
      const value = normalizeFieldValue("medium", rawMedium)
      const existing = medium.get(value)
      if (!existing) {
        medium.set(value, { count: 1, lastUsedAt: createdAt })
      } else {
        existing.count += 1
        if (createdAt > existing.lastUsedAt) existing.lastUsedAt = createdAt
      }
    }
    if (rawDimensions && rawDimensions.trim()) {
      const value = normalizeFieldValue("dimensions", rawDimensions)
      const existing = dimensions.get(value)
      if (!existing) {
        dimensions.set(value, { count: 1, lastUsedAt: createdAt })
      } else {
        existing.count += 1
        if (createdAt > existing.lastUsedAt) existing.lastUsedAt = createdAt
      }
    }
  }

  return { medium, dimensions }
}

export async function getFieldOptions(): Promise<FieldOptionsResult> {
  try {
    const usage = await countInUse()

    const supabase = await db()
    const { data, error } = await supabase
      .from("field_options")
      .select("field, value, last_used_at")
      .order("last_used_at", { ascending: false })

    if (error) {
      if (isSchemaSetupError(error)) {
        // Table missing — derive the lists straight from paintings.
        const toRows = (
          map: Map<string, { count: number; lastUsedAt: string }>
        ): FieldOptionRow[] =>
          [...map.entries()]
            .map(([value, { count, lastUsedAt }]) => ({
              value,
              lastUsedAt,
              inUse: count,
            }))
            .sort((a, b) => (a.lastUsedAt < b.lastUsedAt ? 1 : -1))

        return {
          ok: true,
          source: "paintings",
          options: {
            medium: toRows(usage.medium),
            dimensions: toRows(usage.dimensions),
          },
        }
      }
      throw error
    }

    const options: Record<FieldOptionField, FieldOptionRow[]> = {
      medium: [],
      dimensions: [],
    }
    for (const row of data ?? []) {
      const field = (row as { field: FieldOptionField }).field
      const value = (row as { value: string }).value
      const lastUsedAt = (row as { last_used_at: string }).last_used_at
      if (field !== "medium" && field !== "dimensions") continue
      const inUse = usage[field].get(value)?.count ?? 0
      options[field].push({ value, lastUsedAt, inUse })
    }

    return { ok: true, source: "table", options }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load field options"
    return { ok: false, error: message }
  }
}

export async function touchFieldOptions(input: {
  medium?: string | null
  dimensions?: string | null
}): Promise<{ ok: boolean }> {
  try {
    const supabase = await db()
    const nowIso = new Date().toISOString()

    const rows: { field: FieldOptionField; value: string; last_used_at: string }[] = []
    if (input.medium && input.medium.trim()) {
      rows.push({
        field: "medium",
        value: normalizeFieldValue("medium", input.medium),
        last_used_at: nowIso,
      })
    }
    if (input.dimensions && input.dimensions.trim()) {
      rows.push({
        field: "dimensions",
        value: normalizeFieldValue("dimensions", input.dimensions),
        last_used_at: nowIso,
      })
    }
    if (rows.length === 0) return { ok: true }

    const { error } = await supabase
      .from("field_options")
      .upsert(rows, { onConflict: "field,value" })

    if (error && !isSchemaSetupError(error)) throw error
    if (!error) revalidate()
    return { ok: true }
  } catch {
    // Never throw — this is a best-effort side write after a painting save.
    return { ok: true }
  }
}

const AddFieldOptionSchema = z.object({
  field: z.enum(["medium", "dimensions"]),
  value: z.string().trim().min(1, "Value is required").max(80, "Too long"),
})

export async function addFieldOption(
  field: FieldOptionField,
  value: string
): Promise<{ ok: boolean; error?: string }> {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  const parsed = AddFieldOptionSchema.safeParse({ field, value })
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  try {
    const supabase = await db()
    const normalized = normalizeFieldValue(parsed.data.field, parsed.data.value)
    const { error } = await supabase.from("field_options").upsert(
      { field: parsed.data.field, value: normalized, last_used_at: new Date().toISOString() },
      { onConflict: "field,value" }
    )
    if (error) {
      if (isSchemaSetupError(error)) return { ok: false, error: SCHEMA_SETUP_MESSAGE }
      throw error
    }
    revalidate()
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to add option"
    return { ok: false, error: message }
  }
}

export async function removeFieldOption(
  field: FieldOptionField,
  value: string
): Promise<{ ok: boolean; error?: string }> {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  const parsed = AddFieldOptionSchema.safeParse({ field, value })
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  try {
    const supabase = await db()
    // Does NOT touch paintings — just removes the suggestion from the list.
    const { error } = await supabase
      .from("field_options")
      .delete()
      .eq("field", parsed.data.field)
      .eq("value", parsed.data.value)
    if (error) {
      if (isSchemaSetupError(error)) return { ok: false, error: SCHEMA_SETUP_MESSAGE }
      throw error
    }
    revalidate()
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to remove option"
    return { ok: false, error: message }
  }
}
