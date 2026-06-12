"use server"

import { Resend } from "resend"
import { marked } from "marked"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getUser } from "@/lib/supabase/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  renderNewsletterHtml,
  renderNewsletterPlainText,
} from "@/lib/email/templates"

const RESEND_FREE_TIER_LIMIT = 100

const SendNewsletterSchema = z.object({
  subject: z.string().min(1, "Subject is required").max(200, "Subject must be 200 characters or fewer"),
  bodyMarkdown: z.string().min(1, "Body is required").max(50000, "Body must be 50,000 characters or fewer"),
})

export async function sendNewsletter(input: {
  subject: string
  bodyMarkdown: string
}) {
  const user = await getUser()
  if (!user) return { ok: false as const, error: "Unauthorized" }

  const parsed = SendNewsletterSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0].message }
  }
  const { subject, bodyMarkdown } = parsed.data

  const adminClient = createAdminClient()

  // Guard: check subscriber count before writing anything
  const { count, error: countError } = await adminClient
    .from("contacts")
    .select("*", { count: "exact", head: true })
    .eq("subscribed", true)

  if (countError) {
    return { ok: false as const, error: "Failed to count subscribers" }
  }

  if ((count ?? 0) > RESEND_FREE_TIER_LIMIT) {
    return {
      ok: false as const,
      error: `Recipient count (${count}) exceeds free-tier limit (${RESEND_FREE_TIER_LIMIT}). Upgrade Resend plan or contact developer.`,
    }
  }

  // Insert audit row with status='sending'
  const bodyHtml = marked.parse(bodyMarkdown) as string

  const { data: newsletter, error: insertError } = await adminClient
    .from("newsletters")
    .insert({
      subject,
      body_markdown: bodyMarkdown,
      body_html: bodyHtml,
      status: "sending",
      recipient_count: 0,
      sent_by_user_email: user.email ?? null,
    })
    .select("id")
    .single()

  if (insertError || !newsletter) {
    return { ok: false as const, error: "Failed to create newsletter record" }
  }

  // Fetch all subscribed contacts
  const { data: contacts, error: contactsError } = await adminClient
    .from("contacts")
    .select("email, unsubscribe_token, first_name")
    .eq("subscribed", true)

  if (contactsError) {
    await adminClient
      .from("newsletters")
      .update({ status: "failed", error_message: "Failed to fetch contacts" })
      .eq("id", newsletter.id)
    return { ok: false as const, error: "Failed to fetch subscribers" }
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://jamie-art.vercel.app"
  const fromEmail =
    process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev"

  let sent = 0
  const failures: string[] = []

  for (const contact of contacts ?? []) {
    const unsubscribeUrl = `${siteUrl}/unsubscribe?token=${contact.unsubscribe_token}`
    try {
      await resend.emails.send({
        from: fromEmail,
        to: contact.email,
        subject,
        html: renderNewsletterHtml({ subject, bodyMarkdown, unsubscribeUrl }),
        text: renderNewsletterPlainText({ bodyMarkdown, unsubscribeUrl }),
      })
      sent++
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown error"
      failures.push(`${contact.email}: ${msg}`)
    }
  }

  const finalStatus =
    sent === 0 && failures.length > 0 ? "failed" : "completed"

  await adminClient
    .from("newsletters")
    .update({
      status: finalStatus,
      recipient_count: sent,
      error_message:
        failures.length > 0 ? failures.slice(0, 10).join("; ") : null,
    })
    .eq("id", newsletter.id)

  revalidatePath("/admin/newsletters")

  return {
    ok: true as const,
    data: {
      sent,
      failed: failures.length,
      newsletter_id: newsletter.id,
    },
  }
}
