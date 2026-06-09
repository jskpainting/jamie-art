"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getUser } from "@/lib/supabase/auth"
import { InquiryStatusSchema, type InquiryStatusInput } from "@/lib/schemas"

function revalidateInquiries() {
  revalidatePath("/admin/inquiries")
  revalidatePath("/admin")
}

export async function updateInquiryStatus(
  id: string,
  status: InquiryStatusInput
) {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  const parsed = InquiryStatusSchema.safeParse(status)
  if (!parsed.success) {
    return { ok: false, error: "Invalid status" }
  }

  try {
    const supabase = await createClient()
    const { error } = await supabase
      .from("inquiries")
      .update({ status: parsed.data })
      .eq("id", id)
    if (error) throw error
    revalidateInquiries()
    return { ok: true }
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to update inquiry status"
    return { ok: false, error: message }
  }
}

export async function deleteInquiry(id: string) {
  const user = await getUser()
  if (!user) return { ok: false, error: "Unauthorized" }

  try {
    const supabase = await createClient()
    const { error } = await supabase.from("inquiries").delete().eq("id", id)
    if (error) throw error
    revalidateInquiries()
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete inquiry"
    return { ok: false, error: message }
  }
}
