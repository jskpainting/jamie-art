/**
 * Shared (client + server) helpers for the remembered Medium/Size dropdown
 * lists. Not "use server" — pure functions, safe to import from client
 * components like option-select.tsx.
 */

export type FieldOptionField = "medium" | "dimensions"

export const FIELD_LABELS: Record<FieldOptionField, string> = {
  medium: "Medium",
  dimensions: "Size",
}

/**
 * Normalise a raw Medium/Size value so near-duplicates collapse into one
 * entry (e.g. `12" x 12"` and `12"x12"` are the same "dimensions" value).
 * - Both fields: trim.
 * - dimensions: also collapse ALL whitespace (no spaces at all) and fold
 *   `×`/`X` to a lowercase `x`.
 * - medium: collapse runs of whitespace down to a single space.
 */
export function normalizeFieldValue(field: FieldOptionField, raw: string): string {
  const trimmed = raw.trim()
  if (field === "dimensions") {
    return trimmed.replace(/\s+/g, "").replace(/[×X]/g, "x")
  }
  return trimmed.replace(/\s+/g, " ")
}
