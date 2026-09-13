"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { format } from "date-fns"
import { Plus, Pencil, Trash2, Users, Upload, X, Settings2, ChevronDown } from "lucide-react"
import { updateContact, deleteContact, bulkUnsubscribe } from "@/lib/actions/contacts"
import { bulkAddToGroup, bulkAddTag } from "@/lib/actions/crm"
import { CsvImport } from "@/components/admin/csv-import"
import { DataTable } from "@/components/admin/data-table"
import { ConfirmDialog } from "@/components/admin/confirm-dialog"
import { EmptyState } from "@/components/admin/empty-state"
import { ListToolbar, FilteredEmptyState } from "@/components/admin/list-toolbar"
import { GroupsTagsDialog } from "@/components/admin/groups-tags-dialog"
import { ContactFormDialog } from "./contact-form-dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type { Contact, ContactsStats, ContactRow, ContactGroup } from "@/lib/types"

interface ContactsClientProps {
  contacts: Contact[]
  stats: ContactsStats
  rows: ContactRow[]
  groups: (ContactGroup & { member_count: number })[]
  tags: { name: string; inUse: number }[]
  crmEnabled: boolean
}

type SubscribedFilter = "all" | "subscribed" | "unsubscribed"
type SortKey = "newest" | "oldest" | "name" | "email" | "activity"

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "name", label: "Name A–Z" },
  { value: "activity", label: "Last activity" },
]

const FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "subscribed", label: "Subscribed" },
  { value: "unsubscribed", label: "Unsubscribed" },
]

function contactName(c: Contact) {
  return [c.first_name, c.last_name].filter(Boolean).join(" ")
}

function csvEscape(v: string) {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`
  return v
}

function downloadCsv(filename: string, header: string[], rows: string[][]) {
  const lines = [header, ...rows].map((r) => r.map(csvEscape).join(","))
  const blob = new Blob([lines.join("\n") + "\n"], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function ContactsClient({
  contacts,
  stats,
  rows,
  groups,
  tags,
  crmEnabled,
}: ContactsClientProps) {
  const [search, setSearch] = useState("")
  const [subscribedFilter, setSubscribedFilter] = useState<SubscribedFilter>("all")
  const [groupFilter, setGroupFilter] = useState<string>("all")
  const [tagFilter, setTagFilter] = useState<string>("all")
  const [purchasesFilter, setPurchasesFilter] = useState<string>("all")
  const [sort, setSort] = useState<SortKey>("newest")
  const [addOpen, setAddOpen] = useState(false)
  const [editContact, setEditContact] = useState<Contact | null>(null)
  const [showImport, setShowImport] = useState(contacts.length === 0)
  const [groupsTagsOpen, setGroupsTagsOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [addTagOpen, setAddTagOpen] = useState(false)
  const [addTagValue, setAddTagValue] = useState("")
  const [bulkBusy, setBulkBusy] = useState(false)

  const hasActiveFilters =
    search.trim().length > 0 ||
    subscribedFilter !== "all" ||
    groupFilter !== "all" ||
    tagFilter !== "all" ||
    purchasesFilter !== "all"

  function clearFilters() {
    setSearch("")
    setSubscribedFilter("all")
    setGroupFilter("all")
    setTagFilter("all")
    setPurchasesFilter("all")
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let result = rows.filter((c) => {
      if (subscribedFilter === "subscribed" && !c.subscribed) return false
      if (subscribedFilter === "unsubscribed" && c.subscribed) return false
      if (groupFilter !== "all" && !c.group_names.includes(groupFilter)) return false
      if (tagFilter !== "all" && !c.tags.includes(tagFilter)) return false
      if (purchasesFilter === "has" && c.purchase_count === 0) return false
      if (!q) return true
      return (
        c.email.toLowerCase().includes(q) ||
        (c.first_name ?? "").toLowerCase().includes(q) ||
        (c.last_name ?? "").toLowerCase().includes(q) ||
        (c.phone ?? "").toLowerCase().includes(q)
      )
    })
    result = [...result].sort((a, b) => {
      switch (sort) {
        case "oldest":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        case "name":
          return contactName(a).localeCompare(contactName(b))
        case "activity": {
          const at = a.last_activity_at ? new Date(a.last_activity_at).getTime() : 0
          const bt = b.last_activity_at ? new Date(b.last_activity_at).getTime() : 0
          return bt - at
        }
        case "newest":
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
    })
    return result
  }, [rows, search, subscribedFilter, groupFilter, tagFilter, purchasesFilter, sort])

  const existingEmails = contacts.map((c) => c.email)
  const selectedRows = filtered.filter((r) => selected.has(r.id))

  function toggleSelected(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function toggleSelectAll(checked: boolean) {
    setSelected(checked ? new Set(filtered.map((r) => r.id)) : new Set())
  }

  function exportSelectedCsv() {
    const target = selectedRows.length > 0 ? selectedRows : filtered
    downloadCsv(
      "people.csv",
      ["email", "first_name", "last_name", "phone", "city", "tags", "groups", "subscribed"],
      target.map((c) => [
        c.email,
        c.first_name ?? "",
        c.last_name ?? "",
        c.phone ?? "",
        c.city ?? "",
        (c.tags ?? []).join(";"),
        c.group_names.join(";"),
        c.subscribed ? "yes" : "no",
      ])
    )
  }

  async function handleBulkAddToGroup(groupId: string) {
    setBulkBusy(true)
    try {
      const result = await bulkAddToGroup([...selected], groupId)
      if (!result.ok) toast.error(result.error, { duration: 5000 })
      else {
        toast.success("Added to group", { duration: 5000 })
        setSelected(new Set())
      }
    } finally {
      setBulkBusy(false)
    }
  }

  async function handleBulkAddTag() {
    const tag = addTagValue.trim()
    if (!tag) return
    setBulkBusy(true)
    try {
      const result = await bulkAddTag([...selected], tag)
      if (!result.ok) toast.error(result.error, { duration: 5000 })
      else {
        toast.success("Tag added", { duration: 5000 })
        setSelected(new Set())
        setAddTagOpen(false)
        setAddTagValue("")
      }
    } finally {
      setBulkBusy(false)
    }
  }

  async function handleBulkUnsubscribe() {
    const result = await bulkUnsubscribe([...selected])
    if (!result.ok) throw new Error(result.error)
    toast.success("Unsubscribed", { duration: 5000 })
    setSelected(new Set())
  }

  const columns = crmEnabled
    ? [
        { key: "select", label: "", className: "w-8" },
        { key: "name", label: "Name" },
        { key: "email", label: "Email" },
        { key: "chips", label: "Groups / tags", className: "hidden md:table-cell" },
        { key: "purchases", label: "Purchases", className: "hidden sm:table-cell" },
        { key: "subscribed", label: "Subscribed", className: "hidden sm:table-cell" },
      ]
    : [
        { key: "email", label: "Email" },
        { key: "name", label: "Name" },
        { key: "source", label: "Source", className: "hidden sm:table-cell" },
        { key: "subscribed", label: "Subscribed", className: "hidden md:table-cell" },
        { key: "created_at", label: "Added", className: "hidden lg:table-cell" },
      ]

  function renderCell(row: Record<string, unknown>, key: string) {
    const contact = row as unknown as ContactRow
    if (key === "select") {
      return (
        <Checkbox
          checked={selected.has(contact.id)}
          onCheckedChange={(checked) => toggleSelected(contact.id, !!checked)}
          aria-label={`Select ${contact.email}`}
        />
      )
    }
    if (key === "email") return <span className="font-mono text-xs">{contact.email}</span>
    if (key === "name") {
      const name = [contact.first_name, contact.last_name].filter(Boolean).join(" ")
      if (crmEnabled) {
        return (
          <Link
            href={`/admin/contacts/${contact.id}`}
            className="text-sm font-medium hover:underline underline-offset-2"
          >
            {name || contact.email}
          </Link>
        )
      }
      return <span className="text-sm">{name || "—"}</span>
    }
    if (key === "chips") {
      if (contact.group_names.length === 0 && (contact.tags ?? []).length === 0) {
        return <span className="text-xs text-muted-foreground">—</span>
      }
      return (
        <div className="flex flex-wrap gap-1">
          {contact.group_names.map((g) => (
            <Badge key={g} variant="default" className="text-[10px]">
              {g}
            </Badge>
          ))}
          {(contact.tags ?? []).map((t) => (
            <Badge key={t} variant="outline" className="text-[10px]">
              {t}
            </Badge>
          ))}
        </div>
      )
    }
    if (key === "purchases") {
      return <span className="text-sm">{contact.purchase_count || "—"}</span>
    }
    if (key === "source") return <span className="text-xs text-muted-foreground">{contact.source}</span>
    if (key === "subscribed") {
      if (crmEnabled) {
        return (
          <span
            className={cn(
              "inline-block h-2.5 w-2.5 rounded-full",
              contact.subscribed ? "bg-green-500" : "bg-muted-foreground/30"
            )}
            title={contact.subscribed ? "Subscribed" : "Unsubscribed"}
          />
        )
      }
      return (
        <Checkbox
          checked={contact.subscribed}
          onCheckedChange={async (checked) => {
            const result = await updateContact(contact.id, { subscribed: !!checked })
            if (result.ok) toast.success("Contact updated")
            else toast.error(result.error)
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

  const allSelected = filtered.length > 0 && selected.size === filtered.length

  return (
    <div className="space-y-6">
      {/* CSV Import — collapsible */}
      {showImport && (
        <div className="rounded-xl border border-border bg-card p-4 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs uppercase tracking-[0.2em] font-medium text-muted-foreground">
              Import from CSV
            </p>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setShowImport(false)}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <CsvImport existingEmails={existingEmails} />
          {!crmEnabled && (
            <p className="text-xs text-muted-foreground mt-3">
              Phone, city, tags, group and notes columns will start saving once a
              quick one-time setup runs — email, first and last name work now.
            </p>
          )}
        </div>
      )}

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

      {/* Actions */}
      <div className="flex flex-wrap justify-end gap-2">
        {crmEnabled && (
          <Button variant="outline" size="sm" onClick={() => setGroupsTagsOpen(true)}>
            <Settings2 className="h-4 w-4 mr-1" />
            Groups & tags
          </Button>
        )}
        {!showImport && (
          <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
            <Upload className="h-4 w-4 mr-1" />
            Import CSV
          </Button>
        )}
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add person
        </Button>
      </div>

      {/* Toolbar */}
      <ListToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search people…"
        searchLabel="Search people"
        filterValue={subscribedFilter}
        onFilterChange={(v) => setSubscribedFilter(v as SubscribedFilter)}
        filterOptions={FILTER_OPTIONS}
        filterLabel="Filter by subscription"
        sortValue={sort}
        onSortChange={(v) => setSort(v as SortKey)}
        sortOptions={SORT_OPTIONS}
        sortLabel="Sort people"
        resultCount={filtered.length}
        totalCount={rows.length || contacts.length}
        itemNoun="people"
        hasActiveFilters={hasActiveFilters}
        onClear={clearFilters}
      >
        {crmEnabled && (
          <>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="sr-only">Filter by group</span>
              <select
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
                aria-label="Filter by group"
                className="h-10 sm:h-8 min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="all">All groups</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.name}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="sr-only">Filter by tag</span>
              <select
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                aria-label="Filter by tag"
                className="h-10 sm:h-8 min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="all">All tags</option>
                {tags.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="sr-only">Filter by purchases</span>
              <select
                value={purchasesFilter}
                onChange={(e) => setPurchasesFilter(e.target.value)}
                aria-label="Filter by purchases"
                className="h-10 sm:h-8 min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="all">Any purchases</option>
                <option value="has">Has purchases</option>
              </select>
            </label>
          </>
        )}
      </ListToolbar>

      {/* Bulk bar */}
      {crmEnabled && selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
          <div className="flex items-center gap-2 mr-2">
            <Checkbox checked={allSelected} onCheckedChange={(c) => toggleSelectAll(!!c)} />
            <span className="text-sm text-muted-foreground">{selected.size} selected</span>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger
              className="inline-flex items-center gap-1 h-8 rounded-lg border border-input bg-background px-2.5 text-sm disabled:opacity-50"
              disabled={bulkBusy || groups.length === 0}
            >
              Add to group
              <ChevronDown className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {groups.map((g) => (
                <DropdownMenuItem key={g.id} onClick={() => handleBulkAddToGroup(g.id)}>
                  {g.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" size="sm" disabled={bulkBusy} onClick={() => setAddTagOpen(true)}>
            Add tag
          </Button>

          <ConfirmDialog
            trigger={
              <Button variant="outline" size="sm" disabled={bulkBusy}>
                Unsubscribe
              </Button>
            }
            title="Unsubscribe selected people"
            description={`Unsubscribe ${selected.size} ${selected.size === 1 ? "person" : "people"} from the mailing list?`}
            confirmLabel="Unsubscribe"
            onConfirm={handleBulkUnsubscribe}
          />

          <Button variant="outline" size="sm" onClick={exportSelectedCsv}>
            Export CSV
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-muted-foreground"
            onClick={() => setSelected(new Set())}
          >
            Clear
          </Button>
        </div>
      )}

      {/* Table */}
      <DataTable
        columns={columns}
        rows={(crmEnabled ? filtered : contacts) as unknown as Record<string, unknown>[]}
        renderCell={renderCell}
        actions={
          crmEnabled
            ? undefined
            : (row) => {
                const contact = row as unknown as Contact
                return (
                  <>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-foreground/60 hover:text-foreground"
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
              }
        }
        emptyState={
          hasActiveFilters ? (
            <FilteredEmptyState query={search} itemNoun="people" onClear={clearFilters} />
          ) : (
            <EmptyState
              icon={Users}
              message="Import or add people to get started."
            />
          )
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

      {crmEnabled && (
        <GroupsTagsDialog
          open={groupsTagsOpen}
          onOpenChange={setGroupsTagsOpen}
          groups={groups}
          tags={tags}
        />
      )}

      <Dialog open={addTagOpen} onOpenChange={setAddTagOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add a tag</DialogTitle>
          </DialogHeader>
          <Input
            value={addTagValue}
            onChange={(e) => setAddTagValue(e.target.value)}
            placeholder="e.g. collector"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                handleBulkAddTag()
              }
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddTagOpen(false)} disabled={bulkBusy}>
              Cancel
            </Button>
            <Button onClick={handleBulkAddTag} disabled={bulkBusy || !addTagValue.trim()}>
              Add tag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
