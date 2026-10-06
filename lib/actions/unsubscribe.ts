"use server"

import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"

// Public (NOT getUser()-guarded) — the unsubscribe token in the newsletter
// link is the only credential. Admin client for the same reason as the
// /unsubscribe page lookup (contacts has auth-only RLS); it only ever flips
// subscribed → false on the one row that token belongs to.

// Not exported — a "use server" file should only export async functions
// (see the note at the bottom of lib/actions/rsvp.ts).
type UnsubscribeStatus = "idle" | "success" | "already" | "invalid" | "error"

const TokenSchema = z.string().uuid()

/**
 * The actual opt-out. Only runs when the person presses the button — never on
 * a page load, so link scanners that pre-fetch email links can't unsubscribe
 * anyone.
 */
export async function unsubscribeByToken(
  _prev: UnsubscribeStatus,
  formData: FormData
): Promise<UnsubscribeStatus> {
  const parsed = TokenSchema.safeParse(formData.get("token"))
  if (!parsed.success) return "invalid"

  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("contacts")
      .update({ subscribed: false })
      .eq("unsubscribe_token", parsed.data)
      .select("id")
    if (error) {
      console.error("unsubscribe update error:", error)
      return "error"
    }
    if (!data || data.length === 0) return "invalid"
    return "success"
  } catch (e) {
    console.error("unsubscribe error:", e)
    return "error"
  }
}
