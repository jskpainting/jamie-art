"use server"

import { revalidatePath } from "next/cache"
import { createAdminClient } from "@/lib/supabase/admin"
import { CommissionInquiryWriteSchema } from "@/lib/schemas"

// Public form — no auth check. Uses admin client to bypass RLS.
export async function submitCommissionInquiry(data: unknown) {
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
