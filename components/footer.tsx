import Link from "next/link"
import { Mail } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { NewsletterForm } from "@/components/newsletter-form"
import { getSettings } from "@/lib/db/queries"

export async function Footer() {
  const settings = await getSettings()

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
            <div className="flex items-center gap-3 mt-4">
              {settings?.instagram_handle ? (
                <a
                  href={`https://instagram.com/${settings.instagram_handle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {/* Instagram icon — not in lucide-react v1.17 */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
                  </svg>
                </a>
              ) : null}
              <Link
                href="/contact"
                aria-label="Contact"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Mail className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Newsletter */}
          <div className="max-w-sm">
            <p className="text-xs uppercase tracking-[0.2em] font-medium text-muted-foreground mb-3">
              Stay in the loop
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Show openings, new work, and studio updates — no noise.
            </p>
            <NewsletterForm />
          </div>
        </div>

        <Separator className="my-8" />

        <div className="flex flex-col sm:flex-row justify-between gap-4 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} Jamie Kendrioski. All rights reserved.</p>
          <nav className="flex flex-wrap gap-x-4 gap-y-2">
            <Link href="/portfolio" className="hover:text-foreground transition-colors">
              Portfolio
            </Link>
            <Link href="/about" className="hover:text-foreground transition-colors">
              About
            </Link>
            <Link href="/events" className="hover:text-foreground transition-colors">
              Events
            </Link>
            <Link href="/commission" className="hover:text-foreground transition-colors">
              Commission
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
