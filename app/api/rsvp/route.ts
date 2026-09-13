import { NextResponse } from "next/server"
import { z } from "zod"
import { rateLimit, clientIp } from "@/lib/rate-limit"
import { respondByToken, respondPublic } from "@/lib/actions/rsvp"

const RsvpApiSchema = z.object({
  eventId: z.string().uuid(),
  token: z.string().uuid().optional(),
  name: z.string().trim().max(200).optional(),
  email: z.string().trim().email().max(320).optional(),
  status: z.enum(["yes", "no", "maybe"]),
  guests: z.coerce.number().int().min(1).max(10).default(1),
  keepMePosted: z.boolean().optional(),
  // Honeypot — a bot fills this hidden field, a real visitor never does.
  website: z.string().optional(),
})

export async function POST(request: Request) {
  if (!rateLimit(`rsvp:${clientIp(request)}`, { limit: 10, windowMs: 60_000 })) {
    return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = RsvpApiSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 })
  }

  const { eventId, token, status, guests, website } = parsed.data

  // Honeypot filled → pretend success, write nothing.
  if (website) {
    return NextResponse.json({ ok: true })
  }

  const result = token
    ? await respondByToken(token, { status, guests })
    : await respondPublic(eventId, {
        name: parsed.data.name,
        email: parsed.data.email,
        status,
        guests,
        keepMePosted: parsed.data.keepMePosted ?? false,
      })

  if (!result.ok) {
    if ("reason" in result) {
      const httpStatus =
        result.reason === "invalid" ? 400 : result.reason === "not_found" ? 404 : 200
      return NextResponse.json({ ok: false, reason: result.reason }, { status: httpStatus })
    }
    return NextResponse.json({ ok: false, error: result.error }, { status: 200 })
  }

  return NextResponse.json({ ok: true })
}
