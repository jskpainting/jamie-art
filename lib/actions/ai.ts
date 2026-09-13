"use server"

import { z } from "zod"
import { getUser } from "@/lib/supabase/auth"
import { rateLimit, clientIpFromHeaders } from "@/lib/rate-limit"
import { runTextEx, aiConfigured } from "@/lib/ai/router"
import { createAdminClient } from "@/lib/supabase/admin"
import { SITE_URL, ARTIST_NAME } from "@/lib/site"
import { formatEventDateRange } from "@/lib/utils"

const GeneratePaintingStoryInput = z.object({
  notes: z.string().trim().min(1, "Add a few words first").max(2000, "That's a lot — trim it down a bit"),
  title: z.string().trim().max(300).nullable().optional(),
  medium: z.string().trim().max(200).nullable().optional(),
  dimensions: z.string().trim().max(100).nullable().optional(),
  year: z.union([z.string(), z.number()]).nullable().optional(),
})

export type GeneratePaintingStoryInput = z.infer<typeof GeneratePaintingStoryInput>

const SYSTEM_PROMPT = `You write short gallery placard text for a painter's website. You are given the artist's own rough notes about one painting — keywords, feelings, fragments of thought — and turn them into a brief, evocative description of the painting itself.

Rules, strictly:
- Write 1 to 3 sentences, at most about 55 words total.
- Present tense. Concrete and sensory — describe what the painting IS or DOES, not how the artist felt making it.
- Ground everything ONLY in the notes provided. Never invent biography, prices, dates, awards, exhibition history, or where or when it was painted.
- Do not repeat the painting's title verbatim.
- Avoid cliches: "captivating", "mesmerizing", "journey", "masterpiece", "breathtaking", "stunning", "timeless".
- No quotation marks anywhere in your answer.
- No preamble, no label, no "Here is a story:" — output the prose itself and nothing else.
- Do not address the reader or use the word "you".`

const MAX_STORY_CHARS = 500

/** Strip a leading "Story:"-style label, quotes, and collapse whitespace/blank lines. */
function postProcessStory(raw: string): string {
  let text = raw.trim()
  // Strip a leading label like "Story:", "Description:", "Placard:" etc.
  text = text.replace(/^(story|description|placard|caption|text)\s*[:\-—]\s*/i, "")
  // Strip wrapping quotes (straight or curly) if the whole thing is quoted.
  text = text.replace(/^["'“‘]+/, "").replace(/["'”’]+$/, "")
  // Collapse multiple blank lines / excess whitespace.
  text = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ")
  text = text.replace(/\s+/g, " ").trim()
  // Hard length cap as a final safety net.
  if (text.length > MAX_STORY_CHARS) {
    text = text.slice(0, MAX_STORY_CHARS).trim()
    // Avoid cutting mid-word where reasonably possible.
    const lastSpace = text.lastIndexOf(" ")
    if (lastSpace > MAX_STORY_CHARS - 40) text = text.slice(0, lastSpace)
    text = text.trim() + "…"
  }
  return text
}

function buildPrompt(input: GeneratePaintingStoryInput): string {
  const context: string[] = []
  if (input.title) context.push(`Title: ${input.title}`)
  if (input.medium) context.push(`Medium: ${input.medium}`)
  if (input.dimensions) context.push(`Dimensions: ${input.dimensions}`)
  if (input.year) context.push(`Year: ${input.year}`)

  const contextBlock = context.length > 0 ? `Light context (for reference only, do not just restate it):\n${context.join("\n")}\n\n` : ""

  return `${contextBlock}The artist's notes about this painting:\n${input.notes}\n\nWrite the gallery placard description now.`
}

export async function generatePaintingStory(input: unknown) {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  const parsed = GeneratePaintingStoryInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  try {
    const { headers } = await import("next/headers")
    const h = await headers()
    const ip = clientIpFromHeaders(h)
    const allowed = rateLimit(`ai-story:${ip}`, { limit: 20, windowMs: 60 * 60_000 })
    if (!allowed) {
      return {
        ok: false,
        error: "You've generated a lot of stories in the last hour — try again a bit later.",
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
        "The story writer needs a free AI key added first — see docs/AI_SETUP.md for a 2-minute setup (Groq or Google Gemini both work and cost nothing).",
    }
  }

  try {
    const { text, provider } = await runTextEx({
      prompt: buildPrompt(parsed.data),
      system: SYSTEM_PROMPT,
      maxTokens: 180,
      temperature: 0.8,
    })
    const story = postProcessStory(text)
    if (!story) {
      return { ok: false, error: "The AI didn't return anything usable — try again or add more notes." }
    }
    return { ok: true, story, provider }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to generate a story"
    return { ok: false, error: message }
  }
}

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
