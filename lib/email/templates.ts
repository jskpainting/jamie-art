import { marked } from "marked"

interface NewsletterParams {
  subject: string
  bodyMarkdown: string
  unsubscribeUrl: string
  /** Recipient's first name — substituted for `{{FIRST_NAME}}`. Falls back to "there". */
  firstName?: string | null
  /** When set, an RSVP button is rendered — at `{{RSVP_BUTTON}}` if present, else appended
   * before the footer/sign-off. Omit entirely for a non-event send. */
  rsvpUrl?: string | null
}

const FIRST_NAME_TOKEN = "{{FIRST_NAME}}"
const RSVP_TOKEN = "{{RSVP_BUTTON}}"
const RSVP_BUTTON_LABEL = "RSVP — I’ll be there"

function substituteFirstName(markdown: string, firstName?: string | null): string {
  return markdown.split(FIRST_NAME_TOKEN).join(firstName?.trim() || "there")
}

/** Replaces `{{RSVP_BUTTON}}` with `block` if present, else appends `block` at the end
 * (before the template's own footer). `block` is null when there's no event to invite to. */
function applyRsvpButton(markdown: string, block: string | null): string {
  if (markdown.includes(RSVP_TOKEN)) {
    return markdown.split(RSVP_TOKEN).join(block ?? "")
  }
  return block ? `${markdown.trimEnd()}\n\n${block}\n` : markdown
}

/** Bulletproof (table-based) button markup — renders correctly in Outlook and other
 * clients that don't support styled anchors. Left as raw HTML for `marked` to pass through. */
function rsvpButtonHtml(rsvpUrl: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px 0"><tr><td style="border-radius:6px;background-color:#0A0A0A"><a href="${rsvpUrl}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:6px">${RSVP_BUTTON_LABEL}</a></td></tr></table>`
}

function rsvpButtonPlainText(rsvpUrl: string): string {
  return `${RSVP_BUTTON_LABEL}: ${rsvpUrl}`
}

export function renderNewsletterHtml({
  subject,
  bodyMarkdown,
  unsubscribeUrl,
  firstName,
  rsvpUrl,
}: NewsletterParams): string {
  let markdown = substituteFirstName(bodyMarkdown, firstName)
  markdown = applyRsvpButton(markdown, rsvpUrl ? rsvpButtonHtml(rsvpUrl) : null)
  const bodyHtml = marked.parse(markdown) as string

  // Style the rendered markdown block: replace tag-level styles for email clients
  const styledBody = bodyHtml
    .replace(/<h1/g, '<h1 style="font-family:Georgia,\'Times New Roman\',serif;font-size:28px;font-weight:400;color:#0A0A0A;margin:24px 0 12px 0;line-height:1.3"')
    .replace(/<h2/g, '<h2 style="font-family:Georgia,\'Times New Roman\',serif;font-size:22px;font-weight:400;color:#0A0A0A;margin:20px 0 10px 0;line-height:1.3"')
    .replace(/<h3/g, '<h3 style="font-family:Georgia,\'Times New Roman\',serif;font-size:18px;font-weight:400;color:#0A0A0A;margin:16px 0 8px 0;line-height:1.3"')
    .replace(/<p>/g, '<p style="font-family:Inter,-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;font-size:16px;line-height:1.7;color:#0A0A0A;margin:0 0 16px 0">')
    .replace(/<ul>/g, '<ul style="font-family:Inter,-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;font-size:16px;line-height:1.7;color:#0A0A0A;margin:0 0 16px 0;padding-left:24px">')
    .replace(/<ol>/g, '<ol style="font-family:Inter,-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;font-size:16px;line-height:1.7;color:#0A0A0A;margin:0 0 16px 0;padding-left:24px">')
    .replace(/<li>/g, '<li style="margin-bottom:6px">')
    .replace(/<a /g, '<a style="color:#3D3D3A;text-decoration:underline" ')
    .replace(/<blockquote>/g, '<blockquote style="border-left:3px solid #E8E5DD;margin:0 0 16px 0;padding:8px 16px;color:#6B6B66">')
    .replace(/<hr>/g, '<hr style="border:none;border-top:1px solid #E8E5DD;margin:24px 0">')
    .replace(/<strong>/g, '<strong style="font-weight:600">')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#FAFAF7;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FAFAF7;min-height:100vh">
    <tr>
      <td align="center" style="padding:40px 20px">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#FFFFFF">

          <!-- Header -->
          <tr>
            <td style="padding:32px 40px 24px 40px;border-bottom:1px solid #E8E5DD">
              <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:400;color:#0A0A0A;letter-spacing:0.02em">Jamie Kendrioski</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 40px">
              ${styledBody}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px 32px 40px;border-top:1px solid #E8E5DD">
              <p style="margin:0 0 8px 0;font-family:Inter,-apple-system,sans-serif;font-size:12px;color:#6B6B66;line-height:1.6">
                You&rsquo;re receiving this because you signed up at jamiekendrioski.com
              </p>
              <p style="margin:0;font-family:Inter,-apple-system,sans-serif;font-size:12px;color:#6B6B66">
                <a href="${unsubscribeUrl}" style="color:#6B6B66;text-decoration:underline">Unsubscribe</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function renderNewsletterPlainText({
  bodyMarkdown,
  unsubscribeUrl,
  firstName,
  rsvpUrl,
}: Omit<NewsletterParams, "subject">): string {
  let markdown = substituteFirstName(bodyMarkdown, firstName)
  markdown = applyRsvpButton(markdown, rsvpUrl ? rsvpButtonPlainText(rsvpUrl) : null)
  const plain = stripMarkdown(markdown)
  return `${plain}

---
You're receiving this because you signed up at jamiekendrioski.com
Unsubscribe: ${unsubscribeUrl}`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function stripMarkdown(md: string): string {
  return md
    // ATX headings → text
    .replace(/^#{1,6}\s+/gm, "")
    // Bold / italic
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
    .replace(/_{1,3}([^_]+)_{1,3}/g, "$1")
    // Inline code
    .replace(/`([^`]+)`/g, "$1")
    // Fenced code blocks
    .replace(/```[\s\S]*?```/g, "")
    // Links: [text](url) → text (url)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    // Images: ![alt](url) → [image: alt]
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "[image: $1]")
    // Blockquotes
    .replace(/^>\s*/gm, "")
    // Horizontal rules
    .replace(/^[-*_]{3,}\s*$/gm, "---")
    // Collapse extra blank lines
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}
