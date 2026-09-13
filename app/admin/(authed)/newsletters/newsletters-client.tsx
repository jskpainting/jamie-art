"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { ChevronDown, ChevronUp, Send, MailCheck } from "lucide-react"
import { format } from "date-fns"
import { PageHeader } from "@/components/admin/page-header"
import { MarkdownEditor } from "@/components/admin/markdown-editor"
import { WriteNewsletterCard } from "@/components/admin/write-newsletter-card"
import { AudiencePicker, type AudienceGroupOption, type AudienceTagOption } from "@/components/admin/audience-picker"
import { ConfirmDialog } from "@/components/admin/confirm-dialog"
import { ListToolbar, FilteredEmptyState } from "@/components/admin/list-toolbar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { sendNewsletter, sendTestNewsletter } from "@/lib/actions/newsletters"
import { renderNewsletterHtml } from "@/lib/email/templates"
import type { Newsletter, NewsletterAudience, Event } from "@/lib/types"
import type { AudienceInput } from "@/lib/schemas"
import type { PaintingForPicker } from "@/lib/db/queries"

const PREVIEW_UNSUBSCRIBE_URL = "https://example.com/unsubscribe?token=preview"

type EventRsvpCounts = { yes: number; no: number; maybe: number; invited: number }

interface Props {
  newsletters: Newsletter[]
  subscriberCount: number
  paintings: PaintingForPicker[]
  aiConfigured: boolean
  crmEnabled: boolean
  rsvpEnabled: boolean
  groups: AudienceGroupOption[]
  tags: AudienceTagOption[]
  eventRsvpCounts: Record<string, EventRsvpCounts>
  inviteEvent: Event | null
  inviteRequest: string | null
}

/** Human label for an audience selector — mirrors lib/actions/newsletters.ts's
 * server-side version (kept separate since that module is server-actions-only). */
function audienceLabel(audience: AudienceInput | NewsletterAudience | null | undefined, subscriberCount: number): string {
  if (!audience || audience.type === "all") return "All subscribers"
  if ("label" in audience && audience.label) return audience.label
  if (audience.type === "groups") return `${audience.ids.length} group${audience.ids.length !== 1 ? "s" : ""}`
  if (audience.type === "tags") return `${audience.names.length} tag${audience.names.length !== 1 ? "s" : ""}`
  if (audience.type === "people") return `${audience.ids.length} ${audience.ids.length === 1 ? "person" : "people"}`
  return `${subscriberCount} subscribers`
}

type SortKey = "newest" | "oldest"

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
]

export function NewslettersClient({
  newsletters: initialNewsletters,
  subscriberCount,
  paintings,
  aiConfigured,
  crmEnabled,
  rsvpEnabled,
  groups,
  tags,
  eventRsvpCounts,
  inviteEvent,
  inviteRequest,
}: Props) {
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [newsletters] = useState(initialNewsletters)
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState<SortKey>("newest")
  const [sendingTest, setSendingTest] = useState(false)
  const [audience, setAudience] = useState<AudienceInput>({ type: "all" })
  const [audienceCount, setAudienceCount] = useState<number | null>(subscriberCount)
  const [eventId] = useState<string | undefined>(inviteEvent?.id)

  // Subject auto-suggested from the first heading if left blank — as few
  // clicks as possible: type/generate a body, subject fills itself in.
  function handleBodyChange(next: string) {
    setBody(next)
    if (!subject.trim()) {
      const match = next.match(/^#{1,6}\s+(.+)$/m)
      if (match) setSubject(match[1].trim())
    }
  }

  const hasActiveFilters = search.trim().length > 0

  const filteredNewsletters = useMemo(() => {
    const q = search.trim().toLowerCase()
    const result = q
      ? newsletters.filter((nl) => nl.subject.toLowerCase().includes(q))
      : newsletters
    return [...result].sort((a, b) => {
      const diff = new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()
      return sort === "newest" ? diff : -diff
    })
  }, [newsletters, search, sort])

  const previewHtml = subject || body
    ? renderNewsletterHtml({
        subject: subject || "(no subject)",
        bodyMarkdown: body || "*Start typing to see a preview…*",
        unsubscribeUrl: PREVIEW_UNSUBSCRIBE_URL,
      })
    : null

  async function handleSend() {
    const result = await sendNewsletter({
      subject,
      bodyMarkdown: body,
      audience: crmEnabled ? audience : undefined,
      eventId,
    })
    if (!result.ok) throw new Error(result.error)
    toast.success(`Newsletter sent to ${result.data.sent} recipient${result.data.sent !== 1 ? "s" : ""}`)
    if (result.data.failed > 0) {
      toast.error(`${result.data.failed} send${result.data.failed !== 1 ? "s" : ""} failed — check the past sends table`)
    }
    setSubject("")
    setBody("")
  }

  async function handleSendTest() {
    setSendingTest(true)
    try {
      const result = await sendTestNewsletter({ subject, bodyMarkdown: body, eventId })
      if (!result.ok) {
        toast.error(result.error, { duration: 5000 })
        return
      }
      toast.success(`Test sent to ${result.data.to}`, { duration: 5000 })
    } catch {
      toast.error("Something went wrong sending the test", { duration: 5000 })
    } finally {
      setSendingTest(false)
    }
  }

  const effectiveCount = crmEnabled ? audienceCount : subscriberCount
  const audienceDisplayLabel = crmEnabled ? audienceLabel(audience, subscriberCount) : "All subscribers"
  const canSend = subject.trim().length > 0 && body.trim().length > 0 && effectiveCount !== 0

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Email" title="Newsletters" />

      {/* Subscriber count */}
      <p className="text-sm text-muted-foreground">
        {subscriberCount}{" "}
        <span className="font-medium text-foreground">subscriber{subscriberCount !== 1 ? "s" : ""}</span>{" "}
        in total
        {inviteEvent && (
          <>
            {" · "}Inviting people to{" "}
            <span className="font-medium text-foreground">{inviteEvent.title}</span>
          </>
        )}
      </p>

      {/* Write it for me */}
      <WriteNewsletterCard
        aiConfigured={aiConfigured}
        hasExistingBody={body.trim().length > 0}
        initialRequest={inviteRequest ?? undefined}
        eventId={eventId}
        onGenerated={(result) => {
          setSubject(result.subject)
          setBody(result.body)
        }}
      />

      {/* Compose */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
        <h2 className="font-medium text-base">Compose</h2>

        <div className="space-y-1.5">
          <Label htmlFor="nl-subject">Subject</Label>
          <Input
            id="nl-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Your subject line…"
            maxLength={200}
          />
        </div>

        {crmEnabled && (
          <div className="space-y-1.5">
            <Label>Who gets this</Label>
            <AudiencePicker
              subscriberCount={subscriberCount}
              groups={groups}
              tags={tags}
              value={audience}
              onChange={setAudience}
              onCountChange={setAudienceCount}
            />
          </div>
        )}

        <div className="space-y-1.5">
          <Label>Body</Label>
          <MarkdownEditor
            value={body}
            onChange={handleBodyChange}
            placeholder="Write your newsletter in Markdown…"
            rows={12}
            toolbar
            paintings={paintings}
            showRsvpButton={rsvpEnabled && !!eventId}
          />
        </div>

        {/* Preview */}
        {previewHtml && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-[0.1em]">
              Email Preview
            </p>
            <div className="border border-border rounded-lg overflow-hidden bg-[#FAFAF7]">
              <div
                style={{ transform: "scale(0.8)", transformOrigin: "top left", width: "125%", height: "auto" }}
              >
                <div
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                  className="pointer-events-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* Send buttons */}
        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            This will send to {effectiveCount ?? "…"} {effectiveCount === 1 ? "person" : "people"} ({audienceDisplayLabel}) — it cannot be undone.
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!canSend || sendingTest}
              onClick={handleSendTest}
              className="gap-2"
            >
              <MailCheck className="h-4 w-4" />
              {sendingTest ? "Sending…" : "Send a test to me"}
            </Button>
            <ConfirmDialog
              trigger={
                <Button
                  disabled={!canSend}
                  className="bg-red-700 hover:bg-red-800 text-white gap-2"
                >
                  <Send className="h-4 w-4" />
                  Send to {effectiveCount ?? "…"} {effectiveCount === 1 ? "person" : "people"}
                </Button>
              }
              title="Send newsletter?"
              description={`Sending to ${effectiveCount ?? 0} ${effectiveCount === 1 ? "person" : "people"} (${audienceDisplayLabel}). This cannot be undone.`}
              destructive
              onConfirm={handleSend}
            />
          </div>
        </div>
      </div>

      {/* Past sends */}
      {newsletters.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-medium text-base">Past sends</h2>

          <ListToolbar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search subject…"
            searchLabel="Search newsletters"
            sortValue={sort}
            onSortChange={(v) => setSort(v as SortKey)}
            sortOptions={SORT_OPTIONS}
            sortLabel="Sort newsletters"
            resultCount={filteredNewsletters.length}
            totalCount={newsletters.length}
            itemNoun="newsletters"
            hasActiveFilters={hasActiveFilters}
            onClear={() => setSearch("")}
          />

          {filteredNewsletters.length === 0 ? (
            <FilteredEmptyState query={search} itemNoun="newsletters" onClear={() => setSearch("")} />
          ) : (
          <div className="rounded-2xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Subject</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Sent</th>
                  {crmEnabled && (
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Audience</th>
                  )}
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Recipients</th>
                  {rsvpEnabled && (
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">RSVPs</th>
                  )}
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredNewsletters.map((nl) => {
                  const rsvpCounts = nl.event_id ? eventRsvpCounts[nl.event_id] : undefined
                  const colCount = 4 + (crmEnabled ? 1 : 0) + (rsvpEnabled ? 1 : 0)
                  return (
                  <>
                    <tr
                      key={nl.id}
                      className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => setExpandedId(expandedId === nl.id ? null : nl.id)}
                    >
                      <td className="px-4 py-3 font-medium">
                        <div className="flex items-center gap-2">
                          {expandedId === nl.id
                            ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          }
                          <span className="truncate max-w-[200px] md:max-w-xs">{nl.subject}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell whitespace-nowrap">
                        {format(new Date(nl.sent_at), "MMM d, yyyy")}
                      </td>
                      {crmEnabled && (
                        <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell truncate max-w-[160px]">
                          {audienceLabel(nl.audience, nl.recipient_count)}
                        </td>
                      )}
                      <td className="px-4 py-3 text-right text-muted-foreground hidden md:table-cell">
                        {nl.recipient_count}
                      </td>
                      {rsvpEnabled && (
                        <td className="px-4 py-3 text-right text-muted-foreground hidden md:table-cell whitespace-nowrap">
                          {rsvpCounts ? `${rsvpCounts.yes} yes · ${rsvpCounts.no} no` : "—"}
                        </td>
                      )}
                      <td className="px-4 py-3 text-right">
                        <StatusBadge status={nl.status} />
                      </td>
                    </tr>
                    {expandedId === nl.id && (
                      <tr key={`${nl.id}-expanded`} className="border-b border-border last:border-0 bg-muted/20">
                        <td colSpan={colCount} className="px-4 py-4">
                          <div className="space-y-3">
                            <div className="sm:hidden text-xs text-muted-foreground">
                              Sent {format(new Date(nl.sent_at), "MMM d, yyyy")} · {nl.recipient_count} recipients
                              {crmEnabled && ` · ${audienceLabel(nl.audience, nl.recipient_count)}`}
                              {rsvpCounts && ` · ${rsvpCounts.yes} yes · ${rsvpCounts.no} no`}
                            </div>
                            <pre className="text-xs bg-background border border-border rounded-lg p-3 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">
                              {nl.body_markdown}
                            </pre>
                            {nl.error_message && (
                              <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 px-3 py-2">
                                <p className="text-xs font-medium text-red-700 dark:text-red-400 mb-1">Send errors</p>
                                <p className="text-xs text-red-600 dark:text-red-300 font-mono break-all">{nl.error_message}</p>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                  )
                })}
              </tbody>
            </table>
          </div>
          )}
        </div>
      )}

      {newsletters.length === 0 && (
        <div className="rounded-2xl border border-border bg-muted/20 px-6 py-10 text-center">
          <p className="text-muted-foreground text-sm">No newsletters sent yet.</p>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: Newsletter["status"] }) {
  if (status === "completed") {
    return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-0">Sent</Badge>
  }
  if (status === "sending") {
    return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border-0">Sending</Badge>
  }
  return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-0">Failed</Badge>
}
