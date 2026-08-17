"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { Mail, Menu } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { buttonVariants } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { SITE_COPY_DEFAULTS } from "@/lib/site-copy"

const navLinks = [
  { href: "/portfolio", label: "Portfolio" },
  { href: "/about", label: "About" },
  { href: "/events", label: "Events" },
  { href: "/commission", label: "Commission" },
  { href: "/contact", label: "Contact" },
]

interface NavSettings {
  instagram_handle: string | null
  email: string | null
  tagline?: string | null
}

interface NavProps {
  navSettings?: NavSettings
}

function NavLinks({
  pathname,
  mobile,
  onClick,
}: {
  pathname: string
  mobile?: boolean
  onClick?: () => void
}) {
  if (mobile) {
    return (
      <div className="space-y-2">
        {navLinks.map((link) => {
          const active = pathname.startsWith(link.href)
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={onClick}
              aria-current={active ? "page" : undefined}
              className={cn(
                "block py-3 text-2xl font-serif transition-colors hover:text-foreground",
                active ? "text-foreground font-medium" : "text-muted-foreground"
              )}
            >
              {link.label}
            </Link>
          )
        })}
      </div>
    )
  }

  return (
    <>
      {navLinks.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          onClick={onClick}
          aria-current={pathname.startsWith(link.href) ? "page" : undefined}
          className={cn(
            "text-sm font-medium transition-colors hover:text-foreground",
            pathname.startsWith(link.href)
              ? "text-foreground"
              : "text-muted-foreground"
          )}
        >
          {link.label}
        </Link>
      ))}
    </>
  )
}

export function Nav({ navSettings }: NavProps) {
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 8)
    handler()
    window.addEventListener("scroll", handler, { passive: true })
    return () => window.removeEventListener("scroll", handler)
  }, [])

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-all duration-200",
        scrolled
          ? "border-b border-border bg-background/80 backdrop-blur-sm"
          : "bg-transparent"
      )}
    >
      <nav className="max-w-7xl mx-auto px-6 md:px-10 flex h-16 items-center justify-between">
        {/* Logo */}
        <Link
          href="/"
          className="font-serif text-base tracking-tight font-medium hover:opacity-80 transition-opacity"
        >
          JAMIEKENDRIOSKI
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8">
          <NavLinks pathname={pathname} />
          <ThemeToggle />
        </div>

        {/* Mobile hamburger — no ThemeToggle here; it lives inside the menu */}
        <div className="flex md:hidden items-center">
          <Sheet open={open} onOpenChange={setOpen}>
            <button
              onClick={() => setOpen(true)}
              className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <SheetContent
              side="right"
              showCloseButton={true}
              className="w-[80vw] max-w-[340px] p-0 flex flex-col"
            >
              {/* Visually hidden title for screen readers */}
              <SheetTitle className="sr-only">Navigation menu</SheetTitle>

              {/* Header — wordmark + eyebrow */}
              <div className="px-6 py-8 shrink-0">
                <Link
                  href="/"
                  onClick={() => setOpen(false)}
                  className="block font-serif font-light text-2xl text-foreground hover:opacity-80 transition-opacity"
                >
                  Jamie Kendrioski
                </Link>
                <p className="mt-2 text-xs uppercase tracking-[0.2em] font-medium text-muted-foreground">
                  {navSettings?.tagline || SITE_COPY_DEFAULTS.tagline_nav}
                </p>
              </div>

              {/* Nav links */}
              <div className="flex-1 overflow-y-auto px-6">
                <NavLinks
                  pathname={pathname}
                  mobile
                  onClick={() => setOpen(false)}
                />
              </div>

              {/* Footer — theme toggle + social icons */}
              <div className="px-6 py-6 border-t border-border bg-muted/30 flex items-center justify-between shrink-0">
                <ThemeToggle />
                <div className="flex items-center gap-3">
                  {navSettings?.instagram_handle && (
                    <a
                      href={`https://instagram.com/${navSettings.instagram_handle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Instagram"
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="18"
                        height="18"
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
                  )}
                  {navSettings?.email && (
                    <a
                      href={`mailto:${navSettings.email}`}
                      aria-label="Email"
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Mail className="h-[18px] w-[18px]" />
                    </a>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  )
}
