import { format } from "date-fns"
import type { InquiryWithPainting, CommissionInquiry } from "@/lib/types"

const SEP = "—".repeat(40)
// mailto: body limits vary by mail client (~2000 chars after encoding is safe)
const MAX_QUOTED_CHARS = 1800

function quoteMessage(msg: string | null | undefined): string {
  if (!msg?.trim()) return "> [no message]"
  return msg
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n")
}

function formatDate(iso: string): string {
  return format(new Date(iso), "MMM d, yyyy 'at' h:mm a")
}

function truncateQuoted(quoted: string): string {
  if (quoted.length <= MAX_QUOTED_CHARS) return quoted
  return (
    quoted.slice(0, MAX_QUOTED_CHARS) +
    "\n> ... [message truncated — see admin panel]"
  )
}

function buildBody(name: string, date: string, quoted: string): string {
  return [
    `Hi ${name},`,
    "",
    "",
    SEP,
    `On ${date}, ${name} wrote:`,
    quoted,
    "Sent from jamie-art.vercel.app",
    SEP,
  ].join("\n")
}

// buildPaintingReplyMailto("painting inquiry")
// Subject: Re: Inquiry about "Summer Light"
// Body:
//   Hi Sarah,
//   [2 blank lines]
//   ————...
//   On Jun 11, 2026 at 10:42 PM, Sarah wrote:
//   > Original message line by line
//   Sent from jamie-art.vercel.app
//   ————...
export function buildPaintingReplyMailto(inq: InquiryWithPainting): string {
  const name = inq.from_name?.trim() || inq.from_email
  const subject = inq.painting_title
    ? `Re: Inquiry about "${inq.painting_title}"`
    : "Re: Your inquiry"
  const quoted = truncateQuoted(quoteMessage(inq.message))
  const body = buildBody(name, formatDate(inq.created_at), quoted)

  return (
    `mailto:${encodeURIComponent(inq.from_email)}` +
    `?subject=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body)}`
  )
}

// buildCommissionReplyMailto("commission inquiry")
// Subject: Re: Your commission inquiry
export function buildCommissionReplyMailto(inq: CommissionInquiry): string {
  const name = inq.from_name?.trim() || inq.from_email
  const subject = "Re: Your commission inquiry"
  const quoted = truncateQuoted(quoteMessage(inq.message))
  const body = buildBody(name, formatDate(inq.created_at), quoted)

  return (
    `mailto:${encodeURIComponent(inq.from_email)}` +
    `?subject=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body)}`
  )
}
