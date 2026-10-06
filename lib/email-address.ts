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

/**
 * The From header for newsletter emails. `envFrom` is RESEND_FROM_EMAIL,
 * which may be a bare address ("hello@x.com") or already "Name <hello@x.com>".
 * When the owner has set a sender name in Settings it replaces any name in
 * the env value; otherwise the env value is used exactly as it is.
 */
export function buildFromHeader(envFrom: string, name: string | null | undefined): string {
  const bracketed = envFrom.match(/<([^<>]+)>/)
  const address = (bracketed ? bracketed[1] : envFrom).trim()
  // Line breaks / angle brackets / quotes in a display name would break the
  // header, so they're dropped.
  const clean = (name ?? "").replace(/[\r\n<>"\\]/g, "").trim()
  if (!clean) return envFrom.trim()
  // RFC 5322: a display name containing punctuation like , . ; : @ must be quoted.
  const display = /[()[\]:;@,.]/.test(clean) ? `"${clean}"` : clean
  return `${display} <${address}>`
}

/** The row whose email really is this address (case-insensitively), if any. */
export function pickEmailMatch<T extends { email: unknown }>(
  rows: T[] | null | undefined,
  email: string
): T | null {
  const wanted = normalizeEmail(email)
  return (rows ?? []).find((r) => typeof r.email === "string" && normalizeEmail(r.email) === wanted) ?? null
}
