"use client"

import Link from "next/link"
import { Link2, Mail } from "lucide-react"
import { Separator } from "@/components/ui/separator"

const currentYear = new Date().getFullYear()

export function Footer() {
  return (
    <footer className="border-t border-border mt-auto">
      <div className="max-w-7xl mx-auto px-6 md:px-10 py-12 md:py-16">
        <div className="flex flex-col md:flex-row justify-between gap-10">
          {/* Brand */}
          <div>
            <Link
              href="/"
              className="font-serif text-lg tracking-tight hover:opacity-80 transition-opacity"
            >
              Jamie Kendrioski
            </Link>
            {/* Social placeholders */}
            <div className="flex items-center gap-3 mt-4">
              <span
                aria-label="Instagram (coming soon)"
                className="text-muted-foreground opacity-40 cursor-not-allowed"
              >
                <Link2 className="h-4 w-4" />
              </span>
              <span
                aria-label="Contact (coming soon)"
                className="text-muted-foreground opacity-40 cursor-not-allowed"
              >
                <Mail className="h-4 w-4" />
              </span>
            </div>
          </div>

          {/* Newsletter placeholder */}
          <div className="max-w-sm">
            <p className="text-xs uppercase tracking-[0.2em] font-medium text-muted-foreground mb-3">
              Stay in the loop
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Show openings, new work, and studio updates — no noise.
            </p>
            {/* Form shell — submit logic in Phase 2 */}
            <form
              onSubmit={(e) => e.preventDefault()}
              className="flex gap-2 max-w-xs"
              aria-label="Newsletter signup"
            >
              <input
                type="email"
                placeholder="your@email.com"
                className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                aria-label="Email address"
              />
              <button
                type="submit"
                className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
              >
                Subscribe
              </button>
            </form>
          </div>
        </div>

        <Separator className="my-8" />

        <div className="flex flex-col sm:flex-row justify-between gap-4 text-xs text-muted-foreground">
          <p>© {currentYear} Jamie Kendrioski. All rights reserved.</p>
          <nav className="flex gap-4">
            <Link href="/portfolio" className="hover:text-foreground transition-colors">
              Portfolio
            </Link>
            <Link href="/about" className="hover:text-foreground transition-colors">
              About
            </Link>
            <Link href="/contact" className="hover:text-foreground transition-colors">
              Contact
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}
