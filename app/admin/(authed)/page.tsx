import type { Metadata } from "next"
import { PageHeader } from "@/components/admin/page-header"
import { ComingSoonCard } from "@/components/admin/coming-soon-card"
import { requireUser } from "@/lib/supabase/auth"
import {
  getPaintingsCount,
  getEventsCount,
  getNewInquiriesCount,
} from "@/lib/db/queries"

export const metadata: Metadata = {
  title: "Dashboard · Admin · Jamie Kendrioski",
}

async function StatCard({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <p className="text-xs uppercase tracking-[0.2em] font-medium text-muted-foreground mb-2">
        {label}
      </p>
      <p className="font-serif text-3xl font-light">{value}</p>
    </div>
  )
}

export default async function DashboardPage() {
  const [user, paintings, events, inquiries] = await Promise.all([
    requireUser(),
    getPaintingsCount(),
    getEventsCount(),
    getNewInquiriesCount(),
  ])

  return (
    <div>
      <PageHeader eyebrow="Dashboard" title="Overview" />

      <p className="text-sm text-muted-foreground mb-8">
        Welcome back,{" "}
        <span className="text-foreground font-medium">{user.email}</span>
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard label="Paintings" value={paintings} />
        <StatCard label="Events" value={events} />
        <StatCard label="New Inquiries" value={inquiries} />
      </div>

      <ComingSoonCard description="Phase 4 adds full CRUD for paintings, bio, events, contacts, and a full inquiries inbox." />
    </div>
  )
}
