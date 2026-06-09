"use client"

import { useState } from "react"
import { toast } from "sonner"
import { format } from "date-fns"
import { Plus, Pencil, Trash2, Search } from "lucide-react"
import { updateContact, deleteContact } from "@/lib/actions/contacts"
import { CsvImport } from "@/components/admin/csv-import"
import { DataTable } from "@/components/admin/data-table"
import { ConfirmDialog } from "@/components/admin/confirm-dialog"
import { ContactFormDialog } from "./contact-form-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import type { Contact, ContactsStats } from "@/lib/types"

interface ContactsClientProps {
  contacts: Contact[]
  stats: ContactsStats
}

export function ContactsClient({ contacts, stats }: ContactsClientProps) {
  const [search, setSearch] = useState("")
  const [addOpen, setAddOpen] = useState(false)
  const [editContact, setEditContact] = useState<Contact | null>(null)

  const filtered = contacts.filter((c) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      c.email.toLowerCase().includes(q) ||
      (c.first_name ?? "").toLowerCase().includes(q) ||
      (c.last_name ?? "").toLowerCase().includes(q)
    )
  })

  const rows = filtered as unknown as Record<string, unknown>[]
  const existingEmails = contacts.map((c) => c.email)

  const columns = [
    { key: "email", label: "Email" },
    { key: "name", label: "Name" },
    { key: "source", label: "Source", className: "hidden sm:table-cell" },
    { key: "subscribed", label: "Subscribed", className: "hidden md:table-cell" },
    { key: "created_at", label: "Added", className: "hidden lg:table-cell" },
  ]

  function renderCell(row: Record<string, unknown>, key: string) {
    const contact = row as unknown as Contact
    if (key === "email") return <span className="font-mono text-xs">{contact.email}</span>
    if (key === "name") {
      const name = [contact.first_name, contact.last_name].filter(Boolean).join(" ")
      return <span className="text-sm">{name || "—"}</span>
    }
    if (key === "source") return <span className="text-xs text-muted-foreground">{contact.source}</span>
    if (key === "subscribed") {
      return (
        <Checkbox
          checked={contact.subscribed}
          onCheckedChange={async (checked) => {
            const result = await updateContact(contact.id, { subscribed: !!checked })
            if (!result.ok) toast.error(result.error)
          }}
          aria-label="Subscribed"
        />
      )
    }
    if (key === "created_at") {
      return (
        <span className="text-xs text-muted-foreground">
          {format(new Date(contact.created_at), "MMM d, yyyy")}
        </span>
      )
    }
    return null
  }

  return (
    <div className="space-y-6">
      {/* CSV Import */}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs uppercase tracking-[0.2em] font-medium text-muted-foreground mb-3">
          Import from CSV
        </p>
        <CsvImport existingEmails={existingEmails} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total", value: stats.total },
          { label: "Subscribed", value: stats.subscribed },
          { label: "Unsubscribed", value: stats.unsubscribed },
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

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contacts…"
            className="pl-8"
          />
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add contact
        </Button>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        rows={rows}
        renderCell={renderCell}
        actions={(row) => {
          const contact = row as unknown as Contact
          return (
            <>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setEditContact(contact)}
                aria-label="Edit contact"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <ConfirmDialog
                trigger={
                  <Button variant="ghost" size="icon-sm" aria-label="Delete contact">
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                }
                title="Delete contact"
                description={`Remove ${contact.email} from the mailing list?`}
                destructive
                onConfirm={async () => {
                  const result = await deleteContact(contact.id)
                  if (!result.ok) throw new Error(result.error)
                  toast.success("Contact deleted")
                }}
              />
            </>
          )
        }}
        emptyState={
          <div className="py-12 text-center text-sm text-muted-foreground">
            {search ? "No contacts match your search." : "No contacts yet."}
          </div>
        }
      />

      <ContactFormDialog open={addOpen} onOpenChange={setAddOpen} />
      {editContact && (
        <ContactFormDialog
          open={!!editContact}
          onOpenChange={(o) => !o && setEditContact(null)}
          contact={editContact}
        />
      )}
    </div>
  )
}
