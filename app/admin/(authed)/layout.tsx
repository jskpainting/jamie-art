import type { Metadata } from "next"
import { Toaster } from "@/components/ui/sonner"
import { AdminShell } from "@/components/admin/shell"
import { PasskeyUpsell } from "@/components/admin/passkey-upsell"
import { isAuthBypassed, requireUser } from "@/lib/supabase/auth"
import { getSchemaCapabilities } from "@/lib/schema-capabilities"

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function AdminAuthedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireUser()
  const capabilities = await getSchemaCapabilities()
  // In dev bypass mode there's no real Supabase account to attach a passkey
  // to (see the account page's own bypass notice), so never offer it there.
  const passkeysCapable = capabilities.passkeys && !isAuthBypassed()

  return (
    <>
      <AdminShell user={user}>{children}</AdminShell>
      <PasskeyUpsell passkeysCapable={passkeysCapable} />
      <Toaster position="top-center" duration={5000} />
    </>
  )
}
