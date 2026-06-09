import Link from "next/link"

export default function NotFound() {
  return (
    <div className="max-w-7xl mx-auto px-6 md:px-10 py-20 md:py-32 flex flex-col items-center text-center">
      <p className="text-xs uppercase tracking-[0.2em] font-medium text-muted-foreground mb-3">
        404
      </p>
      <h1 className="text-3xl md:text-5xl tracking-tight font-light font-serif mb-4">
        Page not found
      </h1>
      <p className="text-base text-muted-foreground mb-8 max-w-md">
        The page you&apos;re looking for doesn&apos;t exist or may have moved.
        Explore the portfolio or head back home.
      </p>
      <div className="flex items-center gap-4">
        <Link
          href="/portfolio"
          className="inline-flex items-center gap-2 text-sm font-medium text-foreground border border-border rounded-lg px-5 h-10 hover:bg-muted transition-colors"
        >
          View Portfolio
        </Link>
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Go home →
        </Link>
      </div>
    </div>
  )
}
