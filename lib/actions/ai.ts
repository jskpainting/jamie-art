"use server"

import { z } from "zod"
import { getUser } from "@/lib/supabase/auth"
import { rateLimit, clientIpFromHeaders } from "@/lib/rate-limit"
import { runTextEx, aiConfigured } from "@/lib/ai/router"

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
