import type { Metadata } from "next"
import { requireUser } from "@/lib/supabase/auth"

// Deliberately bare — no <AdminShell>, no sidebar. This subtree renders
// print-only sheets; a sidebar in the DOM would print stray chrome even with
// print:hidden guards on odd browsers, so it's simplest to never mount it.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function AdminPrintLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireUser()
  return <>{children}</>
}
