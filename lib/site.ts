// Central SEO / site-identity constants. Single source of truth for the
// production origin, brand strings, and social links used across metadata,
// sitemap, robots, and structured data.

/** Production origin (no trailing slash). Falls back to the live domain. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.jamiekendrioski.com"
).replace(/\/+$/, "")

export const SITE_NAME = "Jamie Kendrioski"
export const ARTIST_NAME = "Jamie Kendrioski"
export const ARTIST_LOCATION = "Boston"

/** Public social profiles — used for `sameAs` in structured data. */
export const INSTAGRAM_URL = "https://instagram.com/jskpaintings"

/** Default Open Graph / Twitter share image (1200×630, in /public). */
export const OG_IMAGE_PATH = "/og-image.png"

/** Build an absolute URL from a site-relative path. */
export function absoluteUrl(path = ""): string {
  if (!path) return SITE_URL
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`
}

/**
 * Descriptive image alt text for a painting. Falls back to a keyword-aware
 * default that names the artist when no bespoke alt is stored.
 */
export function paintingAlt(title: string, custom?: string | null): string {
  if (custom && custom.trim()) return custom.trim()
  return `${title} — painting by ${ARTIST_NAME}`
}
