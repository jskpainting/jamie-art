import { NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { rateLimit, clientIp } from "@/lib/rate-limit"

const schema = z.object({
  email: z.string().email().max(320),
})

export async function POST(request: Request) {
  if (!rateLimit(`newsletter:${clientIp(request)}`, { limit: 5, windowMs: 60_000 })) {
    // Silent 200 to avoid revealing the limiter / enumeration.
    return NextResponse.json({ ok: true })
  }
  try {
    const body = await request.json()
    const parsed = schema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 })
    }

    const supabase = createAdminClient()

    // This endpoint is public and unauthenticated. An upsert that forced
    // subscribed: true let anyone re-subscribe someone who had opted out,
    // just by typing their address into the signup box — and it overwrote
    // the original `source` while doing it. An existing row is therefore
    // left exactly as it is: an opt-out stays opted out, and the owner can
    // re-subscribe someone deliberately from /admin/contacts.
    const { data: existing, error: lookupError } = await supabase
      .from("contacts")
      .select("id")
      .eq("email", parsed.data.email)
      .maybeSingle()

    if (lookupError) {
      console.error("newsletter lookup error:", lookupError)
      // Still 200 to prevent enumeration.
      return NextResponse.json({ ok: true })
    }

    if (existing) {
      // Already known — say nothing either way.
      return NextResponse.json({ ok: true })
    }

    const { error } = await supabase.from("contacts").insert({
      email: parsed.data.email,
      source: "newsletter_form",
      subscribed: true,
    })

    // 23505 = someone signed up between the lookup and the insert. That is a
    // known contact, not a failure.
    if (error && error.code !== "23505") {
      console.error("newsletter insert error:", error)
      // Still return 200 to prevent enumeration
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (err) {
    console.error("newsletter route error:", err)
    // Always 200 for newsletter
    return NextResponse.json({ ok: true })
  }
}
