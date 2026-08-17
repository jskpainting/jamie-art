import Link from "next/link"

interface PageCardProps {
  title: string
  /** Public route to preview this page, e.g. "/" or "/commission". */
  href?: string
  children: React.ReactNode
}

/**
 * Presentational wrapper for the "Edit your site" cards — one card per
 * public page, grouping that page's editable text and images together.
 */
export function PageCard({ title, href, children }: PageCardProps) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6 md:p-8">
      <div className="flex items-center justify-between gap-4 mb-6">
        <h2 className="text-lg font-medium">{title}</h2>
        {href && (
          <Link
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
          >
            View page ↗
          </Link>
        )}
      </div>
      <div className="flex flex-col gap-10">{children}</div>
    </section>
  )
}
