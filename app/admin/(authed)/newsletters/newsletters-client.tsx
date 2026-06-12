"use client"

import { useState } from "react"
import { toast } from "sonner"
import { ChevronDown, ChevronUp, Send } from "lucide-react"
import { format } from "date-fns"
import { PageHeader } from "@/components/admin/page-header"
import { MarkdownEditor } from "@/components/admin/markdown-editor"
import { ConfirmDialog } from "@/components/admin/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { sendNewsletter } from "@/lib/actions/newsletters"
import { renderNewsletterHtml } from "@/lib/email/templates"
import type { Newsletter } from "@/lib/types"

const PREVIEW_UNSUBSCRIBE_URL = "https://example.com/unsubscribe?token=preview"

interface Props {
  newsletters: Newsletter[]
  subscriberCount: number
}

export function NewslettersClient({ newsletters: initialNewsletters, subscriberCount }: Props) {
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [newsletters] = useState(initialNewsletters)

  const previewHtml = subject || body
    ? renderNewsletterHtml({
        subject: subject || "(no subject)",
        bodyMarkdown: body || "*Start typing to see a preview…*",
        unsubscribeUrl: PREVIEW_UNSUBSCRIBE_URL,
      })
    : null

  async function handleSend() {
    const result = await sendNewsletter({ subject, bodyMarkdown: body })
    if (!result.ok) throw new Error(result.error)
    toast.success(`Newsletter sent to ${result.data.sent} subscriber${result.data.sent !== 1 ? "s" : ""}`)
    if (result.data.failed > 0) {
      toast.error(`${result.data.failed} send${result.data.failed !== 1 ? "s" : ""} failed — check the past sends table`)
    }
    setSubject("")
    setBody("")
  }

  const canSend = subject.trim().length > 0 && body.trim().length > 0

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Email" title="Newsletters" />

      {/* Subscriber count */}
      <p className="text-sm text-muted-foreground">
        Sending to{" "}
        <span className="font-medium text-foreground">{subscriberCount}</span>{" "}
        subscriber{subscriberCount !== 1 ? "s" : ""}
      </p>

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

        <div className="space-y-1.5">
          <Label>Body</Label>
          <MarkdownEditor
            value={body}
            onChange={setBody}
            placeholder="Write your newsletter in Markdown…"
            rows={12}
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

        {/* Send button */}
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">
            This will send to all {subscriberCount} subscriber{subscriberCount !== 1 ? "s" : ""} — it cannot be undone.
          </p>
          <ConfirmDialog
            trigger={
              <Button
                disabled={!canSend || subscriberCount === 0}
                className="bg-red-700 hover:bg-red-800 text-white gap-2"
              >
                <Send className="h-4 w-4" />
                Send to {subscriberCount} subscriber{subscriberCount !== 1 ? "s" : ""}
              </Button>
            }
            title="Send newsletter?"
            description={`This will send "${subject}" to ${subscriberCount} subscriber${subscriberCount !== 1 ? "s" : ""}. This cannot be undone.`}
            destructive
            onConfirm={handleSend}
          />
        </div>
      </div>

      {/* Past sends */}
      {newsletters.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-medium text-base">Past sends</h2>
          <div className="rounded-2xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Subject</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Sent</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Recipients</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {newsletters.map((nl) => (
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
                      <td className="px-4 py-3 text-right text-muted-foreground hidden md:table-cell">
                        {nl.recipient_count}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <StatusBadge status={nl.status} />
                      </td>
                    </tr>
                    {expandedId === nl.id && (
                      <tr key={`${nl.id}-expanded`} className="border-b border-border last:border-0 bg-muted/20">
                        <td colSpan={4} className="px-4 py-4">
                          <div className="space-y-3">
                            <div className="sm:hidden text-xs text-muted-foreground">
                              Sent {format(new Date(nl.sent_at), "MMM d, yyyy")} · {nl.recipient_count} recipients
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
                ))}
              </tbody>
            </table>
          </div>
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
