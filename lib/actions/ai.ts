"use server"

import { z } from "zod"
import { getUser } from "@/lib/supabase/auth"
import { rateLimit, clientIpFromHeaders } from "@/lib/rate-limit"
import { runTextEx, aiConfigured } from "@/lib/ai/router"
import { createAdminClient } from "@/lib/supabase/admin"
import { SITE_URL, ARTIST_NAME } from "@/lib/site"
import { formatEventDateRange } from "@/lib/utils"

// The painting "story" writer was removed on 2026-09-13 at the owner's request:
// painting descriptions stay in his own words. AI is used only for admin
// chores such as drafting newsletters below.

// ── Newsletter drafting ──────────────────────────────────────────────────

const GenerateNewsletterInput = z.object({
  request: z.string().trim().min(1, "Tell it what to say first").max(1000, "That's a lot — trim it down a bit"),
  includeNewPaintings: z.boolean().default(true),
  includeEvents: z.boolean().default(true),
  tone: z.enum(["warm", "short", "playful"]).default("warm"),
  /** Set when drafting an "invite people to this event" email (from the
   * newsletters `?event=` flow) — the event is added to the context and the
   * model is told to place `{{RSVP_BUTTON}}` on its own line. */
  eventId: z.string().uuid().optional(),
})

export type GenerateNewsletterInput = z.infer<typeof GenerateNewsletterInput>

const NEWSLETTER_SYSTEM_PROMPT = `You write a short newsletter email for a painter's existing fans and collectors, in Markdown.

Rules, strictly:
- The very first line of your output must be the subject line, formatted exactly as "Subject: ..." — nothing before it.
- After the subject line, write the email body in Markdown, 120 to 250 words.
- Warm, first person (the artist writing to their own fans). No hype cliches: "captivating", "mesmerizing", "journey", "masterpiece", "breathtaking", "stunning", "timeless", "don't miss out", "exciting news".
- Ground everything ONLY in the facts given in the context below. Never invent paintings, prices, dates, shows, or biography that isn't provided.
- When you mention a painting from the context, write it as its own block: an image line \`![Title](image_url)\`, then on the next line \`**Title** — caption\`, then a link line \`[See it](url)\`.
- End with one gentle call to action (e.g. visiting the site or an upcoming show) — nothing pushy.
- No signature block or sign-off name at the end — the email template adds that separately.
- No preamble, no "Here is the newsletter:" — output only the subject line and the body.
- If the context below includes an "Invite to this event" block, this email's purpose is that invitation. Mention the event by name, date and location, and place the literal placeholder \`{{RSVP_BUTTON}}\` alone on its own line where the RSVP button should appear (usually right after inviting them, before any sign-off) — do not describe or link the RSVP yourself, the placeholder becomes the button.`

const TONE_HINTS: Record<GenerateNewsletterInput["tone"], string> = {
  warm: "Tone: warm and personal, like a note to a friend who collects your work.",
  short: "Tone: short and to the point — trim toward the low end of the word count, minimal flourish.",
  playful: "Tone: playful and a little wry, while staying genuine and specific.",
}

interface NewsletterContextPainting {
  title: string
  caption: string | null
  status: string
  url: string
  image_url: string | null
}

interface NewsletterContextEvent {
  title: string
  when: string
  location: string | null
  link: string | null
}

interface NewsletterContextInviteEvent {
  title: string
  when: string
  location: string | null
  description: string | null
}

async function buildNewsletterContext(input: GenerateNewsletterInput): Promise<{
  paintings: NewsletterContextPainting[]
  events: NewsletterContextEvent[]
  instagramHandle: string | null
  inviteEvent: NewsletterContextInviteEvent | null
}> {
  const supabase = createAdminClient()

  let paintings: NewsletterContextPainting[] = []
  if (input.includeNewPaintings) {
    const { data } = await supabase
      .from("paintings")
      .select("title, story, status, slug, primary_image_url, created_at, sections!paintings_section_id_fkey(slug)")
      .order("created_at", { ascending: false })
      .limit(6)
    paintings = (data ?? []).map((p) => {
      const sec = p.sections as unknown as { slug: string } | null
      return {
        title: p.title,
        caption: p.story,
        status: p.status,
        url: `${SITE_URL}/portfolio/${sec?.slug ?? ""}/${p.slug}`,
        image_url: p.primary_image_url,
      }
    })
  }

  let events: NewsletterContextEvent[] = []
  if (input.includeEvents) {
    const { data } = await supabase
      .from("events")
      .select("*")
      .in("status", ["current", "upcoming"])
      .order("starts_at")
    events = (data ?? []).map((e) => ({
      title: e.title,
      when: formatEventDateRange(e.starts_at, e.ends_at),
      location: e.location,
      link: e.link,
    }))
  }

  const { data: settings } = await supabase
    .from("settings")
    .select("instagram_handle")
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle()

  let inviteEvent: NewsletterContextInviteEvent | null = null
  if (input.eventId) {
    const { data: event } = await supabase
      .from("events")
      .select("title, starts_at, ends_at, location, description")
      .eq("id", input.eventId)
      .maybeSingle()
    if (event) {
      inviteEvent = {
        title: event.title,
        when: formatEventDateRange(event.starts_at, event.ends_at),
        location: event.location,
        description: event.description,
      }
    }
  }

  return { paintings, events, instagramHandle: settings?.instagram_handle ?? null, inviteEvent }
}

function buildNewsletterPrompt(
  input: GenerateNewsletterInput,
  context: {
    paintings: NewsletterContextPainting[]
    events: NewsletterContextEvent[]
    instagramHandle: string | null
    inviteEvent: NewsletterContextInviteEvent | null
  }
): string {
  const lines: string[] = []
  lines.push(`Artist: ${ARTIST_NAME}`)
  lines.push(`Site: ${SITE_URL}`)
  if (context.instagramHandle) lines.push(`Instagram: ${context.instagramHandle}`)

  if (context.paintings.length > 0) {
    lines.push("", "Newest paintings (use image_url exactly as given):")
    for (const p of context.paintings) {
      lines.push(
        `- Title: ${p.title} | Status: ${p.status} | Caption: ${p.caption ?? "(no caption)"} | url: ${p.url} | image_url: ${p.image_url ?? "(none)"}`
      )
    }
  }

  if (context.events.length > 0) {
    lines.push("", "Current/upcoming shows:")
    for (const e of context.events) {
      lines.push(
        `- ${e.title} | ${e.when}${e.location ? ` | ${e.location}` : ""}${e.link ? ` | ${e.link}` : ""}`
      )
    }
  }

  if (context.inviteEvent) {
    const e = context.inviteEvent
    lines.push("", "Invite to this event:")
    lines.push(
      `- ${e.title} | ${e.when}${e.location ? ` | ${e.location}` : ""}${e.description ? ` | ${e.description}` : ""}`
    )
  }

  lines.push("", TONE_HINTS[input.tone])
  lines.push("", `What the artist wants this email to say: ${input.request}`)
  lines.push("", "Write the newsletter now.")
  return lines.join("\n")
}

/** Split "Subject: ...\n\n<body>" into { subject, body }. */
function parseNewsletterOutput(raw: string): { subject: string; body: string } {
  const lines = raw.trim().split("\n")
  let subject = ""
  let bodyStart = 0
  const first = lines[0] ?? ""
  const match = first.match(/^subject:\s*(.*)$/i)
  if (match) {
    subject = match[1].trim()
    bodyStart = 1
  }
  const body = lines
    .slice(bodyStart)
    .join("\n")
    .replace(/^\s+/, "")
  return { subject, body }
}

export async function generateNewsletter(input: unknown) {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  const parsed = GenerateNewsletterInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  try {
    const { headers } = await import("next/headers")
    const h = await headers()
    const ip = clientIpFromHeaders(h)
    const allowed = rateLimit(`ai-newsletter:${ip}`, { limit: 20, windowMs: 60 * 60_000 })
    if (!allowed) {
      return {
        ok: false,
        error: "You've generated a lot of drafts in the last hour — try again a bit later.",
      }
    }
  } catch {
    // headers() unavailable in some contexts (e.g. tests) — fail open, the
    // in-process limiter is best-effort anyway.
  }

  if (!aiConfigured()) {
    return {
      ok: false,
      error:
        "To use this, add a free Gemini or Groq key — see the setup note in the project (docs/AI_SETUP.md).",
    }
  }

  try {
    const context = await buildNewsletterContext(parsed.data)
    const { text, provider, attempts } = await runTextEx({
      prompt: buildNewsletterPrompt(parsed.data, context),
      system: NEWSLETTER_SYSTEM_PROMPT,
      maxTokens: 700,
      temperature: 0.8,
    })
    const { subject, body } = parseNewsletterOutput(text)
    if (!body.trim()) {
      return { ok: false, error: "The AI didn't return anything usable — try again or rephrase your request." }
    }
    return { ok: true, subject, body, provider, attempts }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to generate the newsletter"
    return { ok: false, error: message }
  }
}
