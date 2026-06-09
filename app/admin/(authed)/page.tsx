import type { Metadata } from "next"
import Link from "next/link"
import { format } from "date-fns"
import { PageHeader } from "@/components/admin/page-header"
import { requireUser } from "@/lib/supabase/auth"
import {
  getPaintingsCount,
  getEventsCount,
  getNewInquiriesCount,
  getRecentInquiries,
  getRecentContacts,
  getUpcomingEvents,
} from "@/lib/db/queries"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "Dashboard · Admin · Jamie Kendrioski",
}

const QUICK_LINKS = [
  { href: "/admin/bio", label: "Bio" },
  { href: "/admin/portfolio", label: "Portfolio" },
  { href: "/admin/events", label: "Events" },
  { href: "/admin/contacts", label: "Contacts" },
  { href: "/admin/inquiries", label: "Inquiries" },
]

export default async function DashboardPage() {
  const [user, paintings, events, inquiries, recentInquiries, recentContacts, upcomingEvents] =
    await Promise.all([
      requireUser(),
      getPaintingsCount(),
      getEventsCount(),
      getNewInquiriesCount(),
      getRecentInquiries(5),
      getRecentContacts(5),
      getUpcomingEvents(),
    ])

  const nextEvents = upcomingEvents.slice(0, 3)

  return (
    <div>
      <PageHeader eyebrow="Dashboard" title="Overview" />

      <p className="text-sm text-muted-foreground mb-8">
        Welcome back,{" "}
        <span className="text-foreground font-medium">{user.email}</span>
      </p>

      {/* Stat row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          { label: "Paintings", value: paintings },
          { label: "Events", value: events },
          { label: "New Inquiries", value: inquiries },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-6">
            <p className="text-xs uppercase tracking-[0.2em] font-medium text-muted-foreground mb-2">
              {s.label}
            </p>
            <p className="font-serif text-3xl font-light">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Quick links */}
      <div className="rounded-xl border border-border bg-card p-5 mb-6">
        <p className="text-xs uppercase tracking-[0.2em] font-medium text-muted-foreground mb-4">
          Quick Links
        </p>
        <div className="flex flex-wrap gap-2">
          {QUICK_LINKS.map((link) => (
            <Button
              key={link.href}
              variant="outline"
              size="sm"
              render={<Link href={link.href} />}
            >
              {link.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Inquiries */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs uppercase tracking-[0.2em] font-medium text-muted-foreground">
              Recent Inquiries
            </p>
            <Link
              href="/admin/inquiries"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              View all →
            </Link>
          </div>
          {recentInquiries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No inquiries yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {recentInquiries.map((inq) => (
                <li key={inq.id} className="flex items-start gap-3">
                  <span
                    className={`mt-1 inline-block h-2 w-2 rounded-full shrink-0 ${
                      inq.status === "new"
                        ? "bg-blue-500"
                        : inq.status === "replied"
                          ? "bg-green-500"
                          : "bg-muted-foreground/40"
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="text-sm truncate font-medium">
                      {inq.from_name ?? inq.from_email}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono truncate">
                      {inq.from_email}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(new Date(inq.created_at), "MMM d")}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent Contacts */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs uppercase tracking-[0.2em] font-medium text-muted-foreground">
              Recent Contacts
            </p>
            <Link
              href="/admin/contacts"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              View all →
            </Link>
          </div>
          {recentContacts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No contacts yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {recentContacts.map((contact) => (
                <li key={contact.id} className="flex items-start gap-3">
                  <span className="mt-1 inline-block h-2 w-2 rounded-full bg-primary/50 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm truncate font-medium">
                      {[contact.first_name, contact.last_name]
                        .filter(Boolean)
                        .join(" ") || contact.email}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono truncate">
                      {contact.email}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(new Date(contact.created_at), "MMM d")}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Upcoming Events */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs uppercase tracking-[0.2em] font-medium text-muted-foreground">
              Upcoming Events
            </p>
            <Link
              href="/admin/events"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              View all →
            </Link>
          </div>
          {nextEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No upcoming events.
            </p>
          ) : (
            <ul className="space-y-3">
              {nextEvents.map((event) => (
                <li key={event.id} className="flex items-start gap-3">
                  <span className="mt-1 inline-block h-2 w-2 rounded-full bg-amber-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm truncate font-medium">{event.title}</p>
                    {event.location && (
                      <p className="text-xs text-muted-foreground truncate">
                        {event.location}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(new Date(event.starts_at), "MMM d, yyyy")}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
