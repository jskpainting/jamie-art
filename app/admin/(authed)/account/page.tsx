import type { Metadata } from "next"
import { isAuthBypassed } from "@/lib/supabase/auth"
import { getSchemaCapabilities, SCHEMA_SETUP_MESSAGE } from "@/lib/schema-capabilities"
import { PasswordForm } from "./password-form"
import { PasskeysCard } from "./passkeys-card"

export const metadata: Metadata = {
  title: "Account — Admin",
  robots: { index: false },
}

export default async function AccountPage() {
  const bypassed = isAuthBypassed()
  const capabilities = await getSchemaCapabilities()

  return (
    <div className="max-w-md flex flex-col gap-10">
      <div>
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

      {capabilities.passkeys ? (
        bypassed ? (
          <div>
            <h2 className="text-lg font-medium mb-2 flex items-center gap-2">
              Passkeys
            </h2>
            <div className="rounded-lg border border-border bg-muted p-4 text-sm text-muted-foreground leading-relaxed">
              Local dev is running with{" "}
              <code className="text-foreground">ADMIN_AUTH_BYPASS</code> on, so
              there&apos;s no real Supabase account to attach a passkey to.
              Turn bypass off (or test on the live/staging site) to try this.
            </div>
          </div>
        ) : (
          <PasskeysCard />
        )
      ) : (
        <div>
          <h2 className="text-lg font-medium mb-2">Passkeys</h2>
          <div className="rounded-lg border border-border bg-muted p-4 text-sm text-muted-foreground leading-relaxed">
            {SCHEMA_SETUP_MESSAGE}
          </div>
        </div>
      )}
    </div>
  )
}
