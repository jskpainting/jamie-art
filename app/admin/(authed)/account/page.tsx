import type { Metadata } from "next"
import { isAuthBypassed } from "@/lib/supabase/auth"
import { PasswordForm } from "./password-form"

export const metadata: Metadata = {
  title: "Account — Admin",
  robots: { index: false },
}

export default async function AccountPage() {
  const bypassed = isAuthBypassed()

  return (
    <div className="max-w-md">
      <p className="text-xs uppercase tracking-[0.2em] font-medium text-muted-foreground mb-2">
        Account
      </p>
      <h1 className="text-2xl md:text-3xl font-light font-serif tracking-tight mb-1">
        Password
      </h1>
      <p className="text-sm text-muted-foreground mb-8">
        Set or change the password you use as a fallback when the magic-link
        email doesn&apos;t come through.
      </p>

      {bypassed ? (
        <div className="rounded-lg border border-border bg-muted p-4 text-sm text-muted-foreground leading-relaxed">
          Local dev is running with <code className="text-foreground">ADMIN_AUTH_BYPASS</code>{" "}
          on, so you&apos;re signed in as a fake dev user with no real Supabase
          account. Setting a password here would fail — turn bypass off (or
          test on the live/staging site) to actually set one.
        </div>
      ) : (
        <PasswordForm />
      )}
    </div>
  )
}
