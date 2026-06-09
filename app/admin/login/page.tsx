import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { ThemeToggle } from "@/components/theme-toggle"
import { MagicLinkForm } from "@/components/admin/magic-link-form"
import { getUser } from "@/lib/supabase/auth"

export const metadata: Metadata = {
  title: "Sign in · Admin · Jamie Kendrioski",
  robots: { index: false, follow: false },
}

type Props = {
  searchParams: Promise<{ error?: string; next?: string }>
}

export default async function LoginPage({ searchParams }: Props) {
  const user = await getUser()
  if (user) redirect("/admin")

  const { error, next } = await searchParams

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-background px-4">
      {/* Theme toggle — top right */}
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          {/* Header */}
          <div className="mb-8">
            <p className="text-xs uppercase tracking-[0.2em] font-medium text-muted-foreground mb-2">
              Admin
            </p>
            <h1 className="font-serif text-2xl font-light tracking-tight">
              Sign in
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Enter your email to receive a magic link.
            </p>
          </div>

          <MagicLinkForm error={error} next={next} />
        </div>
      </div>
    </div>
  )
}
