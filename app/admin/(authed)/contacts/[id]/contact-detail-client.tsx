"use client"

import { useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { format } from "date-fns"
import { Loader2, Plus, Trash2 } from "lucide-react"
import {
  updateContactDetails,
  setContactGroups,
  addPurchase,
  deletePurchase,
  addNote,
} from "@/lib/actions/crm"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { FormField } from "@/components/admin/form-field"
import { TagPicker } from "@/components/admin/tag-picker"
import { PaintingPicker } from "@/components/admin/painting-picker"
import { ConfirmDialog } from "@/components/admin/confirm-dialog"
import { formatPrice, cn } from "@/lib/utils"

// Duplicated from lib/schema-capabilities.ts rather than imported — that
// module pulls in the server-only Supabase clients, which breaks the client
// bundle for this component (see components/admin/field-options-card.tsx).
const SCHEMA_SETUP_MESSAGE =
  "This feature needs a quick one-time setup that hasn't run yet — everything else works normally."
import type { ContactDetail, ContactGroup } from "@/lib/types"
import type { PaintingForPicker } from "@/lib/db/queries"

interface ContactDetailClientProps {
  contact: ContactDetail
  groups: (ContactGroup & { member_count: number })[]
  allTags: string[]
  paintings: PaintingForPicker[]
  crmEnabled: boolean
}

const ACTIVITY_LABEL: Record<string, string> = {
  note: "Note",
  purchase: "Purchase",
  rsvp: "RSVP",
  newsletter: "Newsletter",
  inquiry: "Enquiry",
  signup: "Signed up",
  import: "Imported",
  group: "Group",
  tag: "Tag",
}

function SectionCard({
  title,
  children,
  action,
}: {
  title: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  )
}

function SetupNote() {
  return <p className="text-xs text-muted-foreground">{SCHEMA_SETUP_MESSAGE}</p>
}

export function ContactDetailClient({
  contact,
  groups,
  allTags,
  paintings,
  crmEnabled,
}: ContactDetailClientProps) {
  // --- Editable card ---------------------------------------------------
  const [firstName, setFirstName] = useState(contact.first_name ?? "")
  const [lastName, setLastName] = useState(contact.last_name ?? "")
  const [phone, setPhone] = useState(contact.phone ?? "")
  const [city, setCity] = useState(contact.city ?? "")
  const [subscribed, setSubscribed] = useState(contact.subscribed)
  const [notes, setNotes] = useState(contact.notes ?? "")
  const [tags, setTags] = useState<string[]>(contact.tags ?? [])
  const [groupIds, setGroupIds] = useState<Set<string>>(
    new Set(contact.groups.map((g) => g.id))
  )
  const [saving, setSaving] = useState(false)

  async function handleSaveDetails() {
    setSaving(true)
    try {
      const detailsResult = await updateContactDetails(contact.id, {
        first_name: firstName || null,
        last_name: lastName || null,
        phone: phone || null,
        city: city || null,
        notes: notes || null,
        subscribed,
        tags,
      })
      if (!detailsResult.ok) {
        toast.error(detailsResult.error, { duration: 5000 })
        return
      }

      if (crmEnabled) {
        const groupsResult = await setContactGroups(contact.id, [...groupIds])
        if (!groupsResult.ok) {
          toast.error(groupsResult.error, { duration: 5000 })
          return
        }
      }

      toast.success("Saved", { duration: 5000 })
    } finally {
      setSaving(false)
    }
  }

  function toggleGroup(id: string) {
    setGroupIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // --- Purchases ---------------------------------------------------------
  const [addingPurchase, setAddingPurchase] = useState(false)
  const [purchaseMode, setPurchaseMode] = useState<"painting" | "other">("painting")
  const [purchasePaintingId, setPurchasePaintingId] = useState<string | null>(null)
  const [purchaseTitle, setPurchaseTitle] = useState("")
  const [purchasePrice, setPurchasePrice] = useState("")
  const [purchaseDate, setPurchaseDate] = useState("")
  const [purchaseNotes, setPurchaseNotes] = useState("")
  const [markSold, setMarkSold] = useState(false)
  const [savingPurchase, setSavingPurchase] = useState(false)

  function resetPurchaseForm() {
    setPurchaseMode("painting")
    setPurchasePaintingId(null)
    setPurchaseTitle("")
    setPurchasePrice("")
    setPurchaseDate("")
    setPurchaseNotes("")
    setMarkSold(false)
  }

  async function handleAddPurchase() {
    setSavingPurchase(true)
    try {
      const result = await addPurchase(contact.id, {
        painting_id: purchaseMode === "painting" ? purchasePaintingId : null,
        title: purchaseMode === "other" ? purchaseTitle || null : null,
        price_cents: purchasePrice ? Math.round(parseFloat(purchasePrice) * 100) : null,
        purchased_on: purchaseDate || null,
        notes: purchaseNotes || null,
        markSold: purchaseMode === "painting" && markSold,
      })
      if (!result.ok) {
        toast.error(result.error, { duration: 5000 })
      } else {
        toast.success("Purchase recorded", { duration: 5000 })
        resetPurchaseForm()
        setAddingPurchase(false)
      }
    } finally {
      setSavingPurchase(false)
    }
  }

  // --- Timeline / notes ----------------------------------------------------
  const [noteText, setNoteText] = useState("")
  const [savingNote, setSavingNote] = useState(false)

  async function handleAddNote() {
    if (!noteText.trim()) return
    setSavingNote(true)
    try {
      const result = await addNote(contact.id, noteText)
      if (!result.ok) toast.error(result.error, { duration: 5000 })
      else {
        toast.success("Note added", { duration: 5000 })
        setNoteText("")
      }
    } finally {
      setSavingNote(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
      {/* Left column — editable card */}
      <SectionCard title="Details">
        <div className="grid grid-cols-2 gap-3">
          <FormField label="First name">
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </FormField>
          <FormField label="Last name">
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </FormField>
        </div>

        <FormField label="Email">
          <Input value={contact.email} disabled className="font-mono text-xs" />
        </FormField>

        <FormField label="Phone">
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(555) 555-5555"
            disabled={!crmEnabled}
          />
        </FormField>

        <FormField label="City">
          <Input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Portland, OR"
            disabled={!crmEnabled}
          />
        </FormField>

        <label className="flex items-center gap-2.5 cursor-pointer">
          <Checkbox checked={subscribed} onCheckedChange={(v) => setSubscribed(!!v)} />
          <span className="text-sm">Subscribed to newsletters</span>
        </label>

        {crmEnabled ? (
          <FormField label="Groups">
            {groups.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No groups yet — create one from Groups &amp; tags on the People page.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {groups.map((g) => {
                  const active = groupIds.has(g.id)
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => toggleGroup(g.id)}
                      className={cn(
                        "text-xs px-2 py-1 rounded-full border transition-colors",
                        active
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {g.name}
                    </button>
                  )
                })}
              </div>
            )}
          </FormField>
        ) : (
          <SetupNote />
        )}

        <FormField label="Tags">
          <TagPicker value={tags} onChange={setTags} allTags={allTags} />
        </FormField>

        <FormField label="Notes">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Private notes about this person…"
            rows={4}
            disabled={!crmEnabled}
          />
        </FormField>

        <Button onClick={handleSaveDetails} disabled={saving} className="w-full">
          {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
          {saving ? "Saving…" : "Save"}
        </Button>
      </SectionCard>

      {/* Right column */}
      <div className="space-y-6">
        {/* Purchases */}
        <SectionCard
          title="Purchases"
          action={
            crmEnabled ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAddingPurchase((v) => !v)}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add purchase
              </Button>
            ) : undefined
          }
        >
          {!crmEnabled ? (
            <SetupNote />
          ) : (
            <>
              {addingPurchase && (
                <div className="rounded-lg border border-border p-3 space-y-3">
                  <div className="flex gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setPurchaseMode("painting")}
                      className={cn(
                        "px-2.5 py-1 rounded-full border",
                        purchaseMode === "painting"
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border text-muted-foreground"
                      )}
                    >
                      A painting
                    </button>
                    <button
                      type="button"
                      onClick={() => setPurchaseMode("other")}
                      className={cn(
                        "px-2.5 py-1 rounded-full border",
                        purchaseMode === "other"
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border text-muted-foreground"
                      )}
                    >
                      Something else
                    </button>
                  </div>

                  {purchaseMode === "painting" ? (
                    <PaintingPicker
                      paintings={paintings}
                      selectedId={purchasePaintingId}
                      onSelect={setPurchasePaintingId}
                    />
                  ) : (
                    <FormField label="What did they buy?">
                      <Input
                        value={purchaseTitle}
                        onChange={(e) => setPurchaseTitle(e.target.value)}
                        placeholder="e.g. A print, a commission…"
                      />
                    </FormField>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="Price (USD)">
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={purchasePrice}
                        onChange={(e) => setPurchasePrice(e.target.value)}
                        placeholder="1500.00"
                      />
                    </FormField>
                    <FormField label="Date">
                      <Input
                        type="date"
                        value={purchaseDate}
                        onChange={(e) => setPurchaseDate(e.target.value)}
                      />
                    </FormField>
                  </div>

                  <FormField label="Notes">
                    <Textarea
                      value={purchaseNotes}
                      onChange={(e) => setPurchaseNotes(e.target.value)}
                      rows={2}
                    />
                  </FormField>

                  {purchaseMode === "painting" && purchasePaintingId && (
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <Checkbox checked={markSold} onCheckedChange={(v) => setMarkSold(!!v)} />
                      <span className="text-sm">Also mark the painting as sold</span>
                    </label>
                  )}

                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleAddPurchase} disabled={savingPurchase}>
                      {savingPurchase && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                      Save purchase
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        resetPurchaseForm()
                        setAddingPurchase(false)
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {contact.purchases.length === 0 ? (
                <p className="text-sm text-muted-foreground">No purchases recorded yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {contact.purchases.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm truncate">
                          {p.painting_slug && p.painting_section_slug ? (
                            <Link
                              href={`/admin/portfolio/${p.painting_section_slug}`}
                              className="hover:underline underline-offset-2"
                            >
                              {p.painting_title ?? p.title ?? "Untitled"}
                            </Link>
                          ) : (
                            p.title ?? "Untitled"
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {p.purchased_on ? format(new Date(p.purchased_on), "MMM d, yyyy") : "No date"}
                          {p.price_cents != null && ` · ${formatPrice(p.price_cents)}`}
                        </p>
                      </div>
                      <ConfirmDialog
                        trigger={
                          <Button variant="ghost" size="icon-sm" aria-label="Delete purchase">
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        }
                        title="Delete purchase"
                        description="Remove this purchase record?"
                        destructive
                        onConfirm={async () => {
                          const result = await deletePurchase(p.id)
                          if (!result.ok) throw new Error(result.error)
                          toast.success("Purchase deleted", { duration: 5000 })
                        }}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </SectionCard>

        {/* Events */}
        <SectionCard title="Events">
          {!crmEnabled ? (
            <SetupNote />
          ) : contact.rsvps.length === 0 ? (
            <p className="text-sm text-muted-foreground">No RSVPs yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {contact.rsvps.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm truncate">{r.event_title}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.event_starts_at ? format(new Date(r.event_starts_at), "MMM d, yyyy") : ""}
                    </p>
                  </div>
                  <Badge variant={r.status === "yes" ? "default" : "outline"} className="capitalize">
                    {r.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        {/* Enquiries */}
        <SectionCard
          title="Enquiries"
          action={
            <Link
              href="/admin/inquiries"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              View all →
            </Link>
          }
        >
          {contact.inquiries.length === 0 && contact.commissionInquiries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No enquiries yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {contact.inquiries.map((inq) => (
                <li key={inq.id} className="py-2">
                  <p className="text-sm truncate">
                    {inq.painting_title ? `About "${inq.painting_title}"` : "General enquiry"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(inq.created_at), "MMM d, yyyy")} · {inq.status}
                  </p>
                </li>
              ))}
              {contact.commissionInquiries.map((c) => (
                <li key={c.id} className="py-2">
                  <p className="text-sm truncate">Commission enquiry</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(c.created_at), "MMM d, yyyy")} · {c.status}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        {/* Emails received */}
        <SectionCard title="Emails received">
          {!crmEnabled ? (
            <SetupNote />
          ) : contact.newsletters.length === 0 ? (
            <p className="text-sm text-muted-foreground">No newsletters sent yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {contact.newsletters.map((n) => (
                <li key={n.id} className="py-2">
                  <p className="text-sm truncate">{n.subject}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(n.sent_at), "MMM d, yyyy")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        {/* Timeline */}
        <SectionCard title="Timeline">
          {!crmEnabled ? (
            <SetupNote />
          ) : (
            <>
              <div className="flex gap-2">
                <Input
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Add a note…"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      handleAddNote()
                    }
                  }}
                />
                <Button size="sm" onClick={handleAddNote} disabled={savingNote || !noteText.trim()}>
                  {savingNote ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add"}
                </Button>
              </div>

              {contact.activities.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing recorded yet.</p>
              ) : (
                <ul className="space-y-2">
                  {contact.activities.map((a) => (
                    <li key={a.id} className="flex items-start gap-2 text-sm">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary/50 shrink-0" />
                      <div className="min-w-0">
                        <p className="truncate">{a.summary}</p>
                        <p className="text-xs text-muted-foreground">
                          {ACTIVITY_LABEL[a.kind] ?? a.kind} ·{" "}
                          {format(new Date(a.created_at), "MMM d, yyyy")}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </SectionCard>
      </div>
    </div>
  )
}
