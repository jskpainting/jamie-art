// Minimal, dependency-light structured-data renderer. Accepts a single JSON-LD
// object or an array of them and emits <script type="application/ld+json">.
// Kept as a Server Component (no "use client") so it streams with the page.

type JsonLdData = Record<string, unknown> | Record<string, unknown>[]

export function JsonLd({ data }: { data: JsonLdData }) {
  return (
    <script
      type="application/ld+json"
      // JSON.stringify output is safe to inline; no user HTML is interpolated.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
