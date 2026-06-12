import Link from "next/link"
import { createAdminClient } from "@/lib/supabase/admin"

interface Props {
  searchParams: Promise<{ token?: string }>
}

export const metadata = {
  title: "Unsubscribe — Jamie Kendrioski",
  robots: { index: false },
}

export default async function UnsubscribePage({ searchParams }: Props) {
  const { token } = await searchParams

  if (!token) {
    return <UnsubscribePage.Result status="invalid" />
  }

  const adminClient = createAdminClient()

  const { data: contact } = await adminClient
    .from("contacts")
    .select("id, subscribed")
    .eq("unsubscribe_token", token)
    .single()

  if (!contact) {
    return <UnsubscribePage.Result status="invalid" />
  }

  if (contact.subscribed) {
    await adminClient
      .from("contacts")
      .update({ subscribed: false })
      .eq("id", contact.id)
  }

  return <UnsubscribePage.Result status="success" />
}

UnsubscribePage.Result = function Result({
  status,
}: {
  status: "success" | "invalid"
}) {
  return (
    <div className="max-w-7xl mx-auto px-6 md:px-10 py-20 md:py-32">
      <div className="max-w-lg">
        <p className="text-xs uppercase tracking-[0.2em] font-medium text-muted-foreground mb-4">
          Newsletter
        </p>
        {status === "success" ? (
          <>
            <h1 className="font-serif text-3xl md:text-4xl font-light tracking-tight text-foreground mb-4">
              You&rsquo;ve been unsubscribed.
            </h1>
            <p className="text-muted-foreground text-base leading-relaxed mb-8">
              Sorry to see you go. You won&rsquo;t receive any more emails from
              Jamie.
            </p>
          </>
        ) : (
          <>
            <h1 className="font-serif text-3xl md:text-4xl font-light tracking-tight text-foreground mb-4">
              Invalid unsubscribe link.
            </h1>
            <p className="text-muted-foreground text-base leading-relaxed mb-8">
              This link may have already been used or doesn&rsquo;t exist.
            </p>
          </>
        )}
        <Link
          href="/"
          className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
        >
          Back to home
        </Link>
      </div>
    </div>
  )
}
