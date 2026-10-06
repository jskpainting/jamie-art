import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { UnsubscribeConfirm, UnsubscribeResult } from "./unsubscribe-confirm"

interface Props {
  searchParams: Promise<{ token?: string }>
}

export const dynamic = "force-dynamic"

// The root layout's title template already appends "— Jamie Kendrioski".
export const metadata = {
  title: "Unsubscribe",
  robots: { index: false },
}

/** Read-only token lookup — loading this page never changes anything. */
async function lookupToken(
  token: string | undefined
): Promise<"subscribed" | "already" | "invalid" | "error"> {
  // Not a UUID (e.g. the "preview" token in test sends) → just invalid,
  // rather than a Postgres type error.
  const parsed = z.string().uuid().safeParse(token)
  if (!parsed.success) return "invalid"

  const { data, error } = await createAdminClient()
    .from("contacts")
    .select("id, subscribed")
    .eq("unsubscribe_token", parsed.data)
    .maybeSingle()
  if (error) {
    console.error("unsubscribe lookup error:", error)
    return "error"
  }
  if (!data) return "invalid"
  return data.subscribed ? "subscribed" : "already"
}

/**
 * Email link scanners pre-fetch links, and used to unsubscribe people just by
 * opening this URL. A valid token now shows a confirm screen; the opt-out
 * only happens when the button is pressed (unsubscribeByToken).
 */
export default async function UnsubscribePage({ searchParams }: Props) {
  const { token } = await searchParams
  const state = await lookupToken(token)

  if (state === "subscribed" && token) {
    return <UnsubscribeConfirm token={token} />
  }
  return <UnsubscribeResult status={state === "subscribed" ? "invalid" : state} />
}
