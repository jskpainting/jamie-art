"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  User,
  Image,
  Calendar,
  Users,
  Mail,
  Menu,
  FlaskConical,
  Settings,
} from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { ThemeToggle } from "@/components/theme-toggle"
import { UserMenu } from "@/components/admin/user-menu"
import { cn } from "@/lib/utils"
import type { User as SupabaseUser } from "@supabase/supabase-js"

const navItems = [
  { href: "/admin", label: "Dashboard", Icon: LayoutDashboard, exact: true },
  { href: "/admin/bio", label: "Bio", Icon: User, exact: false },
  { href: "/admin/portfolio", label: "Portfolio", Icon: Image, exact: false },
  { href: "/admin/events", label: "Events", Icon: Calendar, exact: false },
  { href: "/admin/contacts", label: "Contacts", Icon: Users, exact: false },
  { href: "/admin/inquiries", label: "Inquiries", Icon: Mail, exact: false },
  { href: "/admin/settings", label: "Settings", Icon: Settings, exact: false },
]

// Temporary dev tools — removed once their purpose is served
const devNavItems = [
  {
    href: "/admin/layout-preview",
    label: "Layout Preview",
    Icon: FlaskConical,
    exact: false,
  },
]

function NavLink({
  href,
  label,
  Icon,
  isActive,
  onNavClick,
}: {
  href: string
  label: string
  Icon: React.ComponentType<{ className?: string }>
  isActive: boolean
  onNavClick?: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onNavClick}
      className={cn(
        "flex items-center gap-2.5 pr-3 py-2 rounded-lg text-sm transition-colors",
        isActive
          ? "bg-accent/10 text-foreground font-medium border-l-[3px] border-accent pl-[9px]"
          : "text-muted-foreground hover:bg-muted hover:text-foreground pl-3"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </Link>
  )
}

interface SidebarContentProps {
  user: SupabaseUser
  onNavClick?: () => void
}

function SidebarContent({ user, onNavClick }: SidebarContentProps) {
  const pathname = usePathname()

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-border">
        <Link
          href="/admin"
          className="font-serif text-sm tracking-tight font-medium hover:opacity-80 transition-opacity"
          onClick={onNavClick}
        >
          Jamie · Admin
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 overflow-y-auto">
        <div className="space-y-0.5">
          {navItems.map(({ href, label, Icon, exact }) => (
            <NavLink
              key={href}
              href={href}
              label={label}
              Icon={Icon}
              isActive={exact ? pathname === href : pathname.startsWith(href)}
              onNavClick={onNavClick}
            />
          ))}
        </div>

        <p className="px-3 pt-6 pb-2 text-xs uppercase tracking-[0.1em] font-medium text-muted-foreground">
          Dev
        </p>
        <div className="space-y-0.5">
          {devNavItems.map(({ href, label, Icon, exact }) => (
            <NavLink
              key={href}
              href={href}
              label={label}
              Icon={Icon}
              isActive={exact ? pathname === href : pathname.startsWith(href)}
              onNavClick={onNavClick}
            />
          ))}
        </div>
      </nav>

      {/* Bottom: user + theme */}
      <div className="px-2 py-3 border-t border-border space-y-1">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-[0.1em]">
            Theme
          </span>
          <ThemeToggle />
        </div>
        <UserMenu user={user} />
      </div>
    </div>
  )
}

interface AdminShellProps {
  user: SupabaseUser
  children: React.ReactNode
}

export function AdminShell({ user, children }: AdminShellProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border bg-card">
        <SidebarContent user={user} />
      </aside>

      {/* Mobile Sheet — controlled, no SheetTrigger needed */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-60 p-0" showCloseButton={false}>
          <SidebarContent user={user} onNavClick={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <div className="md:hidden flex h-14 shrink-0 items-center border-b border-border px-4 gap-3 bg-card">
          <button
            onClick={() => setOpen(true)}
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-serif text-sm tracking-tight">Admin</span>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
