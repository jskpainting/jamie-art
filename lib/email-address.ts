/**
 * One rule for email addresses on contacts and RSVPs: trimmed + lowercased,
 * so "Jane@Example.com " and "jane@example.com" are the same person.
 *
 * Every write stores the normalised form. Lookups go through
 * `emailMatchPattern` + `pickEmailMatch` (a case-insensitive `ilike`, then an
 * exact check in JS) so they still find rows saved with different casing
 * before the lowercase migration (20261006120000) has been run. The JS check
 * matters because PostgREST treats `*` in an ilike pattern as a wildcard.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** An `ilike` pattern that matches exactly this address, ignoring case. */
export function emailMatchPattern(email: string): string {
  return normalizeEmail(email).replace(/[\\%_]/g, "\\$&")
}

/** The row whose email really is this address (case-insensitively), if any. */
export function pickEmailMatch<T extends { email: unknown }>(
  rows: T[] | null | undefined,
  email: string
): T | null {
  const wanted = normalizeEmail(email)
  return (rows ?? []).find((r) => typeof r.email === "string" && normalizeEmail(r.email) === wanted) ?? null
}
