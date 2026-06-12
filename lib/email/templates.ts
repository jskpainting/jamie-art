import { marked } from "marked"

interface NewsletterParams {
  subject: string
  bodyMarkdown: string
  unsubscribeUrl: string
}

export function renderNewsletterHtml({
  subject,
  bodyMarkdown,
  unsubscribeUrl,
}: NewsletterParams): string {
  const bodyHtml = marked.parse(bodyMarkdown) as string

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
                You&rsquo;re receiving this because you signed up at jamie-art.vercel.app
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
}: Omit<NewsletterParams, "subject">): string {
  const plain = stripMarkdown(bodyMarkdown)
  return `${plain}

---
You're receiving this because you signed up at jamie-art.vercel.app
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
