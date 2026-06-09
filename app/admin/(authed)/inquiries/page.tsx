import type { Metadata } from "next"
import { PageHeader } from "@/components/admin/page-header"
import { ComingSoonCard } from "@/components/admin/coming-soon-card"
import { getNewInquiriesCount } from "@/lib/db/queries"

export const metadata: Metadata = {
  title: "Inquiries · Admin · Jamie Kendrioski",
}

export default async function InquiriesAdminPage() {
  const newCount = await getNewInquiriesCount()

  return (
    <div>
      <PageHeader
        eyebrow="Inquiries"
        title="Inquiries"
        description="Messages from visitors interested in paintings."
      />

      {newCount > 0 && (
        <div className="rounded-2xl border border-border bg-card p-6 mb-6 flex items-center gap-4">
          <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground font-serif text-lg font-light shrink-0">
            {newCount}
          </span>
          <div>
            <p className="text-sm font-medium">
              {newCount === 1 ? "1 new inquiry" : `${newCount} new inquiries`}
            </p>
            <p className="text-xs text-muted-foreground">
              Unread messages waiting for your reply.
            </p>
          </div>
        </div>
      )}

      {newCount === 0 && (
        <div className="rounded-2xl border border-border bg-muted/30 p-6 mb-6">
          <p className="text-sm text-muted-foreground text-center">
            No new inquiries — all caught up.
          </p>
        </div>
      )}

      <ComingSoonCard description="Phase 4 adds a full inbox view — read messages, reply by email, and mark inquiries as replied or closed." />
    </div>
  )
}
