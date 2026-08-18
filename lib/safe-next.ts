/**
 * Open-redirect guard shared by every auth flow that accepts a `?next=`
 * param (magic-link callback, password sign-in, password recovery).
 *
 * Only same-site absolute paths are allowed. Protocol-relative ("//evil.com")
 * and backslash ("/\evil.com") tricks that browsers resolve to an external
 * origin are rejected, along with anything that isn't a leading-slash path.
 */
export function safeNext(rawNext: string | null | undefined, fallback = "/admin"): string {
  if (
    rawNext &&
    rawNext.startsWith("/") &&
    !rawNext.startsWith("//") &&
    !rawNext.startsWith("/\\")
  ) {
    return rawNext
  }
  return fallback
}
