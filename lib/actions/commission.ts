"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { isAuthBypassed, getUser } from "@/lib/supabase/auth"
import { CommissionInquiryWriteSchema } from "@/lib/schemas"
import { rateLimit } from "@/lib/rate-limit"

async function db() {
  return isAuthBypassed() ? createAdminClient() : await createServerClient()
}

// Public form — no auth check. Uses admin client to bypass RLS.
export async function submitCommissionInquiry(data: unknown) {
  const hdrs = await headers()
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown"
  if (!rateLimit(`commission:${ip}`, { limit: 5, windowMs: 60_000 })) {
    return { ok: false, error: "Too many requests. Please try again shortly." }
  }

  const parsed = CommissionInquiryWriteSchema.safeParse(data)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  try {
    const supabase = createAdminClient()
    const { error } = await supabase.from("commission_inquiries").insert({
      from_name: parsed.data.from_name ?? null,
      from_email: parsed.data.from_email,
      from_phone: parsed.data.from_phone ?? null,
      message: parsed.data.message,
      reference_painting_title: parsed.data.reference_painting_title ?? null,
      reference_painting_id: parsed.data.reference_painting_id ?? null,
    })
    if (error) throw error

    revalidatePath("/admin/inquiries")
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to submit inquiry"
    return { ok: false, error: message }
  }
}

const CommissionStatusSchema = z.enum(["new", "replied", "closed"])

export async function updateCommissionInquiryStatus(id: string, status: string) {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  const parsed = CommissionStatusSchema.safeParse(status)
  if (!parsed.success) return { ok: false, error: "Invalid status" }

  try {
    const supabase = await db()
    const { error } = await supabase
      .from("commission_inquiries")
      .update({ status: parsed.data })
      .eq("id", id)
    if (error) throw error
    revalidatePath("/admin/inquiries")
    return { ok: true }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to update status",
    }
  }
}
