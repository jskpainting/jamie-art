"use server"

import { Resend } from "resend"
import { marked } from "marked"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getUser } from "@/lib/supabase/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { SITE_URL } from "@/lib/site"
import { getSchemaCapabilities } from "@/lib/schema-capabilities"
import { AudienceSchema, type AudienceInput } from "@/lib/schemas"
import { resolveAudience, logActivity } from "@/lib/actions/crm"
import { createInvites } from "@/lib/actions/rsvp"
import {
  renderNewsletterHtml,
  renderNewsletterPlainText,
} from "@/lib/email/templates"

const RESEND_FREE_TIER_LIMIT = 100

const SendNewsletterSchema = z.object({
  subject: z.string().min(1, "Subject is required").max(200, "Subject must be 200 characters or fewer"),
  bodyMarkdown: z.string().min(1, "Body is required").max(50000, "Body must be 50,000 characters or fewer"),
  audience: AudienceSchema.optional(),
  eventId: z.string().uuid().optional(),
})

const SendTestNewsletterSchema = z.object({
  subject: z.string().min(1, "Subject is required").max(200, "Subject must be 200 characters or fewer"),
  bodyMarkdown: z.string().min(1, "Body is required").max(50000, "Body must be 50,000 characters or fewer"),
  eventId: z.string().uuid().optional(),
})

/** Human label for an audience selector — used in the confirm dialog and the
 * newsletters.audience row when the picker didn't already attach one. */
function audienceLabel(audience: AudienceInput | undefined): string {
  if (!audience || audience.type === "all") return "All subscribers"
  if ("label" in audience && audience.label) return audience.label
  if (audience.type === "groups") return `${audience.ids.length} group${audience.ids.length !== 1 ? "s" : ""}`
  if (audience.type === "tags") return `${audience.names.length} tag${audience.names.length !== 1 ? "s" : ""}`
  return `${audience.ids.length} ${audience.ids.length === 1 ? "person" : "people"}`
}

/**
 * Sends a single preview copy to the signed-in admin's own email, via the
 * same Resend path as the real send. Not recorded in the newsletters table —
 * it's a preview, not a blast, so it shouldn't show up in Past sends or count
 * toward recipient totals.
 *
 * When `eventId` is set, the RSVP button renders with a `?t=preview` token
 * so the button link is visible without creating a real invite row.
 */
export async function sendTestNewsletter(input: {
  subject: string
  bodyMarkdown: string
  eventId?: string
}) {
  const user = await getUser()
  if (!user) return { ok: false as const, error: "Unauthorized" }
  if (!user.email) {
    return { ok: false as const, error: "Your admin account has no email on file, so a test can't be sent." }
  }

  const parsed = SendTestNewsletterSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0].message }
  }
  const { subject, bodyMarkdown, eventId } = parsed.data

  const fromEmail = process.env.RESEND_FROM_EMAIL
  if (!fromEmail) {
    return {
      ok: false as const,
      error:
        "Your sending email address isn't set up yet, so this wasn't sent. Ask your developer to set RESEND_FROM_EMAIL to an address on your verified domain.",
    }
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const unsubscribeUrl = `${SITE_URL}/unsubscribe?token=preview`
  const rsvpUrl = eventId ? `${SITE_URL}/rsvp/${eventId}?t=preview` : null

  try {
    const { error: sendError } = await resend.emails.send({
      from: fromEmail,
      to: user.email,
      subject: `[Test] ${subject}`,
      html: renderNewsletterHtml({ subject, bodyMarkdown, unsubscribeUrl, rsvpUrl }),
      text: renderNewsletterPlainText({ bodyMarkdown, unsubscribeUrl, rsvpUrl }),
    })
    if (sendError) {
      return { ok: false as const, error: sendError.message ?? "The email service rejected the test send." }
    }
    return { ok: true as const, data: { to: user.email } }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to send the test email"
    return { ok: false as const, error: message }
  }
}

export async function sendNewsletter(input: {
  subject: string
  bodyMarkdown: string
  audience?: AudienceInput
  eventId?: string
}) {
  const user = await getUser()
  if (!user) return { ok: false as const, error: "Unauthorized" }

  const parsed = SendNewsletterSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0].message }
  }
  const { subject, bodyMarkdown } = parsed.data

  const caps = await getSchemaCapabilities()
  // Fall back to "all subscribed" when the CRM columns aren't migrated yet —
  // groups/tags/people selectors can't be trusted before then.
  const audience: AudienceInput = caps.crm && parsed.data.audience ? parsed.data.audience : { type: "all" }
  const eventId = caps.rsvp ? parsed.data.eventId : undefined

  const adminClient = createAdminClient()

  // Resolve the audience to subscribed contact ids before writing anything.
  const resolved = await resolveAudience(audience)
  if (!resolved.ok) {
    return { ok: false as const, error: resolved.error }
  }
  const contactIds = resolved.ids

  if (contactIds.length > RESEND_FREE_TIER_LIMIT) {
    return {
      ok: false as const,
      error: `Recipient count (${contactIds.length}) exceeds free-tier limit (${RESEND_FREE_TIER_LIMIT}). Upgrade Resend plan or contact developer.`,
    }
  }

  // Insert audit row with status='sending'
  const bodyHtml = marked.parse(bodyMarkdown) as string

  const newsletterRow: Record<string, unknown> = {
    subject,
    body_markdown: bodyMarkdown,
    body_html: bodyHtml,
    status: "sending",
    recipient_count: 0,
    sent_by_user_email: user.email ?? null,
  }
  if (caps.crm) newsletterRow.audience = { ...audience, label: audienceLabel(audience) }
  if (caps.rsvp && eventId) newsletterRow.event_id = eventId

  const { data: newsletter, error: insertError } = await adminClient
    .from("newsletters")
    .insert(newsletterRow)
    .select("id")
    .single()

  if (insertError || !newsletter) {
    return { ok: false as const, error: "Failed to create newsletter record" }
  }

  if (contactIds.length === 0) {
    await adminClient
      .from("newsletters")
      .update({ status: "completed", recipient_count: 0 })
      .eq("id", newsletter.id)
    revalidatePath("/admin/newsletters")
    return { ok: true as const, data: { sent: 0, failed: 0, newsletter_id: newsletter.id } }
  }

  const { data: contacts, error: contactsError } = await adminClient
    .from("contacts")
    .select("id, email, unsubscribe_token, first_name")
    .in("id", contactIds)

  if (contactsError) {
    await adminClient
      .from("newsletters")
      .update({ status: "failed", error_message: "Failed to fetch contacts" })
      .eq("id", newsletter.id)
    return { ok: false as const, error: "Failed to fetch subscribers" }
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  // Single canonical origin — a stale fallback here sends unsubscribe links to
  // the wrong domain, which breaks opt-out and hurts deliverability.
  const siteUrl = SITE_URL
  const fromEmail = process.env.RESEND_FROM_EMAIL

  // Resend's onboarding@resend.dev sandbox sender only delivers to the Resend
  // account owner; every other recipient is rejected. Refusing here is far
  // kinder than "sent" followed by silence.
  if (!fromEmail) {
    await adminClient
      .from("newsletters")
      .update({
        status: "failed",
        error_message: "RESEND_FROM_EMAIL is not set",
      })
      .eq("id", newsletter.id)
    return {
      ok: false as const,
      error:
        "Your sending email address isn't set up yet, so this wasn't sent. Nothing has gone out. Ask your developer to set RESEND_FROM_EMAIL to an address on your verified domain.",
    }
  }

  // When inviting to an event, create/reuse the per-contact RSVP tokens
  // before sending, so every email can link straight to that person's page.
  const tokenByContactId = new Map<string, string>()
  if (eventId) {
    const invites = await createInvites(eventId, contactIds)
    if (invites.ok) {
      for (const invite of invites.invites) {
        tokenByContactId.set(invite.contactId, invite.token)
      }
    }
    // Best-effort: if invite creation failed outright, the send continues
    // without RSVP buttons rather than blocking the whole newsletter.
  }

  let sent = 0
  const failures: string[] = []

  for (const contact of contacts ?? []) {
    const contactId = contact.id as string
    const unsubscribeUrl = `${siteUrl}/unsubscribe?token=${contact.unsubscribe_token}`
    const token = tokenByContactId.get(contactId)
    const rsvpUrl = eventId && token ? `${siteUrl}/rsvp/${eventId}?t=${token}` : null
    const firstName = contact.first_name as string | null

    let deliveryOk = false
    try {
      // The Resend SDK does NOT throw on an API error — it returns
      // { data: null, error }. Its only throws are a missing API key and a
      // missing React renderer. Counting a send as successful without checking
      // `error` meant a blast that delivered to nobody still reported "Sent".
      const { error: sendError } = await resend.emails.send({
        from: fromEmail,
        to: contact.email,
        subject,
        html: renderNewsletterHtml({ subject, bodyMarkdown, unsubscribeUrl, firstName, rsvpUrl }),
        text: renderNewsletterPlainText({ bodyMarkdown, unsubscribeUrl, firstName, rsvpUrl }),
      })
      if (sendError) {
        failures.push(
          `${contact.email}: ${sendError.message ?? "rejected by the email service"}`
        )
      } else {
        sent++
        deliveryOk = true
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown error"
      failures.push(`${contact.email}: ${msg}`)
    }

    // Best-effort bookkeeping — never let a broken write here fail the send.
    if (caps.crm) {
      try {
        await adminClient.from("newsletter_recipients").upsert(
          {
            newsletter_id: newsletter.id,
            contact_id: contactId,
            status: deliveryOk ? "sent" : "failed",
          },
          { onConflict: "newsletter_id,contact_id" }
        )
      } catch (e) {
        console.error("newsletter_recipients write failed:", e)
      }
    }
    if (deliveryOk) {
      await logActivity(contactId, "newsletter", `Sent "${subject}"`, newsletter.id as string)
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

// --- Audience picker search ------------------------------------------------

const SearchAudienceContactsSchema = z.object({ q: z.string().trim().max(200) })

export interface AudienceContactOption {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
}

/**
 * Small subscribed-contact search for the "Pick people" audience mode on the
 * compose card. Named distinctly from crm.ts's `searchContacts` (used by the
 * "Sold to" picker) to avoid a naming collision between agents working in
 * parallel — this one only returns subscribed contacts, since unsubscribed
 * people can't actually be picked as newsletter recipients.
 */
export async function searchAudienceContacts(
  q: string
): Promise<{ ok: true; contacts: AudienceContactOption[] } | { ok: false; error: string }> {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  const parsed = SearchAudienceContactsSchema.safeParse({ q })
  if (!parsed.success) return { ok: false, error: "Invalid search" }

  try {
    const supabase = createAdminClient()
    let builder = supabase
      .from("contacts")
      .select("id, email, first_name, last_name")
      .eq("subscribed", true)
      .order("first_name", { ascending: true, nullsFirst: false })
      .limit(25)

    const query = parsed.data.q
    if (query) {
      const like = `%${query.replace(/[%_]/g, "")}%`
      builder = builder.or(`email.ilike.${like},first_name.ilike.${like},last_name.ilike.${like}`)
    }

    const { data, error } = await builder
    if (error) throw error
    return { ok: true, contacts: (data ?? []) as AudienceContactOption[] }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to search people"
    return { ok: false, error: message }
  }
}
