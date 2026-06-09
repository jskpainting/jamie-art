"use client"

import { Fragment, useState } from "react"
import { toast } from "sonner"
import { format } from "date-fns"
import { Trash2, Mail, ChevronDown, ChevronRight } from "lucide-react"
import { updateInquiryStatus, deleteInquiry } from "@/lib/actions/inquiries"
import { ConfirmDialog } from "@/components/admin/confirm-dialog"
import { Button } from "@/components/ui/button"
import type { InquiryWithPainting, InquiriesStats, InquiryStatus } from "@/lib/types"

interface InquiriesClientProps {
  inquiries: InquiryWithPainting[]
  stats: InquiriesStats
}

type FilterTab = "all" | InquiryStatus

export function InquiriesClient({ inquiries, stats }: InquiriesClientProps) {
  const [filter, setFilter] = useState<FilterTab>("all")
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const filtered = inquiries.filter(
    (inq) => filter === "all" || inq.status === filter
  )

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleStatusChange(id: string, status: string) {
    setUpdatingId(id)
    const result = await updateInquiryStatus(id, status as InquiryStatus)
    setUpdatingId(null)
    if (!result.ok) toast.error(result.error)
  }

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: "all", label: "All", count: inquiries.length },
    { key: "new", label: "New", count: stats.new_count },
    { key: "replied", label: "Replied", count: stats.replied_count },
    { key: "closed", label: "Closed", count: stats.closed_count },
  ]

  return (
    <div className="space-y-6">
      {/* Stat row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "New", value: stats.new_count },
          { label: "Replied", value: stats.replied_count },
          { label: "Closed", value: stats.closed_count },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-border bg-card p-3 text-center"
          >
            <p className="text-2xl font-light">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              filter === tab.key
                ? "border-b-2 border-foreground text-foreground -mb-px"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="ml-1.5 text-xs text-muted-foreground">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-muted/30 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            No inquiries in this category.
          </p>
        </div>
      ) : (
        <div className="w-full overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="sticky top-0 z-10 bg-card border-b border-border">
              <tr>
                <th className="w-8 px-4 py-3" />
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  From
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide hidden md:table-cell">
                  Painting
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide hidden sm:table-cell">
                  Date
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Status
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((inq) => {
                const isExpanded = expanded.has(inq.id)
                const isNew = inq.status === "new"
                return (
                  <Fragment key={inq.id}>
                    <tr
                      className={`hover:bg-muted/40 transition-colors ${isNew ? "font-medium" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleExpand(inq.id)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          aria-label={isExpanded ? "Collapse message" : "Expand message"}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm">{inq.from_name ?? "—"}</p>
                          <p className="text-xs font-mono text-muted-foreground">
                            {inq.from_email}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-sm text-muted-foreground">
                          {inq.painting_title ?? "General"}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(inq.created_at), "MMM d, yyyy")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={inq.status}
                          onChange={(e) =>
                            handleStatusChange(inq.id, e.target.value)
                          }
                          disabled={updatingId === inq.id}
                          className="h-7 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                        >
                          <option value="new">New</option>
                          <option value="replied">Replied</option>
                          <option value="closed">Closed</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <a
                            href={`mailto:${inq.from_email}?subject=Re: Your inquiry about ${inq.painting_title ?? "my work"}`}
                            className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                            aria-label="Reply by email"
                          >
                            <Mail className="h-3.5 w-3.5" />
                          </a>
                          <ConfirmDialog
                            trigger={
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Delete inquiry"
                              >
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            }
                            title="Delete inquiry"
                            description={`Permanently delete the message from ${inq.from_email}?`}
                            destructive
                            onConfirm={async () => {
                              const result = await deleteInquiry(inq.id)
                              if (!result.ok) throw new Error(result.error)
                              toast.success("Inquiry deleted")
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-muted/20">
                        <td colSpan={6} className="px-8 py-4">
                          <div className="space-y-2">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                              Message
                            </p>
                            <p className="text-sm whitespace-pre-wrap leading-relaxed max-w-2xl">
                              {inq.message ?? "(no message body)"}
                            </p>
                            <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-muted-foreground">
                              {inq.painting_title && (
                                <span>
                                  Painting:{" "}
                                  <span className="text-foreground">
                                    {inq.painting_title}
                                  </span>
                                </span>
                              )}
                              <span>
                                Received:{" "}
                                {format(new Date(inq.created_at), "PPpp")}
                              </span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
