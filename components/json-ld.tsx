// Minimal, dependency-light structured-data renderer. Accepts a single JSON-LD
// object or an array of them and emits <script type="application/ld+json">.
// Kept as a Server Component (no "use client") so it streams with the page.

type JsonLdData = Record<string, unknown> | Record<string, unknown>[]

// JSON.stringify does NOT escape <, >, & or the JS line separators (U+2028/U+2029),
// so a field value like `</script><img onerror=...>` would break out of the
// <script> block. Escape those to their \uXXXX forms — still valid JSON, safe to
// inline. (Char codes used for the separators to keep this source file ASCII.)
const LINE_SEP = String.fromCharCode(0x2028)
const PARA_SEP = String.fromCharCode(0x2029)

function safeJsonLd(data: JsonLdData): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .split(LINE_SEP)
    .join("\\u2028")
    .split(PARA_SEP)
    .join("\\u2029")
}

export function JsonLd({ data }: { data: JsonLdData }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(data) }}
    />
  )
}
