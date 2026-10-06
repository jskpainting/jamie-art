"use client"

import { useActionState } from "react"
import Link from "next/link"
import { unsubscribeByToken } from "@/lib/actions/unsubscribe"
import { Button } from "@/components/ui/button"

type ResultStatus = "success" | "already" | "invalid" | "error"

export function UnsubscribeConfirm({ token }: { token: string }) {
  const [status, formAction, pending] = useActionState(unsubscribeByToken, "idle")

  if (status !== "idle" && status !== "error") {
    return <UnsubscribeResult status={status} />
  }

  return (
    <Shell>
      <h1 className="font-serif text-3xl md:text-4xl font-light tracking-tight text-foreground mb-4">
        Unsubscribe from Jamie Kendrioski&rsquo;s newsletter?
      </h1>
      <p className="text-muted-foreground text-base leading-relaxed mb-8">
        You&rsquo;ll stop receiving newsletter emails from Jamie.
      </p>
      <form action={formAction} className="mb-8">
        <input type="hidden" name="token" value={token} />
        <Button type="submit" disabled={pending}>
          {pending ? "Unsubscribing…" : "Unsubscribe"}
        </Button>
        {status === "error" && (
          <p className="text-sm text-destructive mt-4" role="alert">
            Something went wrong — please try again.
          </p>
        )}
      </form>
    </Shell>
  )
}

export function UnsubscribeResult({ status }: { status: ResultStatus }) {
  return (
    <Shell>
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
      ) : status === "already" ? (
        <h1 className="font-serif text-3xl md:text-4xl font-light tracking-tight text-foreground mb-8">
          You&rsquo;re already unsubscribed.
        </h1>
      ) : status === "error" ? (
        <h1 className="font-serif text-3xl md:text-4xl font-light tracking-tight text-foreground mb-8">
          Something went wrong — please try again.
        </h1>
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
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-7xl mx-auto px-6 md:px-10 py-20 md:py-32">
      <div className="max-w-lg">
        <p className="text-xs uppercase tracking-[0.2em] font-medium text-muted-foreground mb-4">
          Newsletter
        </p>
        {children}
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
