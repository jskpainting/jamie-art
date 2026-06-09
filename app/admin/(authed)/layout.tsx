import type { Metadata } from "next"
import { Toaster } from "@/components/ui/sonner"
import { AdminShell } from "@/components/admin/shell"
import { requireUser } from "@/lib/supabase/auth"

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function AdminAuthedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireUser()

  return (
    <>
      <AdminShell user={user}>{children}</AdminShell>
      <Toaster />
    </>
  )
}
