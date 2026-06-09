import { NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"

const schema = z.object({
  email: z.string().email(),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = schema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Upsert — always 200/201 to prevent email enumeration
    const { error } = await supabase.from("contacts").upsert(
      {
        email: parsed.data.email,
        source: "newsletter_form",
        subscribed: true,
      },
      { onConflict: "email", ignoreDuplicates: false }
    )

    if (error) {
      console.error("newsletter upsert error:", error)
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
