"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { format } from "date-fns"
import { Download, Mail, Trash2, Users } from "lucide-react"
import { setRsvpStatus, deleteRsvp, exportRsvpsCsv } from "@/lib/actions/rsvp"
import { DataTable } from "@/components/admin/data-table"
import { ConfirmDialog } from "@/components/admin/confirm-dialog"
import { EmptyState } from "@/components/admin/empty-state"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { EventRsvp, RsvpStatus } from "@/lib/types"

const STATUS_OPTIONS: RsvpStatus[] = ["invited", "yes", "no", "maybe"]

const STATUS_COLORS: Record<RsvpStatus, string> = {
  yes: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  no: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  maybe: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  invited: "bg-muted text-muted-foreground",
}

interface RsvpsClientProps {
  eventId: string
  initialRsvps: EventRsvp[]
}

export function RsvpsClient({ eventId, initialRsvps }: RsvpsClientProps) {
  const [rsvps, setRsvps] = useState(initialRsvps)
  const [exporting, setExporting] = useState(false)

  const summary = useMemo(() => {
    const counts = { yes: 0, no: 0, maybe: 0, invited: 0 }
    for (const r of rsvps) counts[r.status] += 1
    return counts
  }, [rsvps])

  const columns = [
    { key: "name", label: "Name" },
    { key: "email", label: "Email" },
    { key: "status", label: "Status" },
    { key: "guests", label: "Guests", className: "hidden sm:table-cell" },
    { key: "source", label: "Source", className: "hidden md:table-cell" },
    { key: "when", label: "When", className: "hidden lg:table-cell" },
  ]

  async function handleStatusChange(id: string, status: RsvpStatus) {
    const previous = rsvps
    setRsvps((rows) => rows.map((r) => (r.id === id ? { ...r, status } : r)))
    const result = await setRsvpStatus(id, status)
    if (!result.ok) {
      setRsvps(previous)
      toast.error(result.error ?? "Failed to update RSVP")
    } else {
      toast.success("RSVP updated")
    }
  }

  async function handleDelete(id: string) {
    const result = await deleteRsvp(id)
    if (!result.ok) throw new Error(result.error)
    setRsvps((rows) => rows.filter((r) => r.id !== id))
    toast.success("RSVP deleted")
  }

  async function handleExport() {
    setExporting(true)
    try {
      const result = await exportRsvpsCsv(eventId)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `rsvps-${eventId}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  function renderCell(row: Record<string, unknown>, key: string) {
    const rsvp = row as unknown as EventRsvp
    if (key === "name") return <span className="text-sm">{rsvp.name || "—"}</span>
    if (key === "email") return <span className="font-mono text-xs">{rsvp.email}</span>
    if (key === "status") {
      return (
        <select
          value={rsvp.status}
          onChange={(e) => handleStatusChange(rsvp.id, e.target.value as RsvpStatus)}
          className={cn(
            "h-7 rounded-full border-0 px-2.5 text-xs font-medium capitalize focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            STATUS_COLORS[rsvp.status]
          )}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      )
    }
    if (key === "guests") return <span className="text-sm">{rsvp.guests}</span>
    if (key === "source") return <span className="text-xs text-muted-foreground">{rsvp.source}</span>
    if (key === "when") {
      return (
        <span className="text-xs text-muted-foreground">
          {format(new Date(rsvp.created_at), "MMM d, yyyy")}
        </span>
      )
    }
    return null
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Yes", value: summary.yes },
          { label: "No", value: summary.no },
          { label: "Maybe", value: summary.maybe },
          { label: "Invited", value: summary.invited },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-3 text-center">
            <p className="text-2xl font-light">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
          <Download className="h-4 w-4 mr-1" />
          {exporting ? "Exporting…" : "Export CSV"}
        </Button>
        <Link href={`/admin/newsletters?event=${eventId}`}>
          <Button size="sm">
            <Mail className="h-4 w-4 mr-1" />
            Invite people
          </Button>
        </Link>
      </div>

      <DataTable
        columns={columns}
        rows={rsvps as unknown as Record<string, unknown>[]}
        renderCell={renderCell}
        emptyState={
          <EmptyState
            icon={Users}
            message="No RSVPs yet. Invite people to get started."
          />
        }
        actions={(row) => {
          const rsvp = row as unknown as EventRsvp
          return (
            <ConfirmDialog
              trigger={
                <Button variant="ghost" size="icon-sm" aria-label="Delete RSVP">
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              }
              title="Delete RSVP"
              description={`${rsvp.name || rsvp.email}'s RSVP will be permanently deleted.`}
              destructive
              onConfirm={() => handleDelete(rsvp.id)}
            />
          )
        }}
      />
    </div>
  )
}
