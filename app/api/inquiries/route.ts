import { NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { rateLimit, clientIp } from "@/lib/rate-limit"

const schema = z.object({
  painting_id: z.string().uuid().optional().nullable(),
  from_email: z.string().email().max(320),
  from_name: z.string().max(200).optional().nullable(),
  message: z.string().max(5000).optional().nullable(),
})

export async function POST(request: Request) {
  if (!rateLimit(`inquiry:${clientIp(request)}`, { limit: 5, windowMs: 60_000 })) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      { status: 429 }
    )
  }
  try {
    const body = await request.json()
    const parsed = schema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", issues: parsed.error.issues },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()
    const { error } = await supabase.from("inquiries").insert({
      painting_id: parsed.data.painting_id ?? null,
      from_email: parsed.data.from_email,
      from_name: parsed.data.from_name ?? null,
      message: parsed.data.message ?? null,
      status: "new",
    })

    if (error) {
      console.error("inquiry insert error:", error)
      return NextResponse.json({ error: "Database error" }, { status: 500 })
    }

    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (err) {
    console.error("inquiry route error:", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
