"use client"

import { useState } from "react"
import { MagicLinkForm } from "@/components/admin/magic-link-form"
import { PasswordLoginForm } from "@/components/admin/password-login-form"

interface LoginMethodSwitcherProps {
  error?: string
  next?: string
}

/**
 * Toggles the login card between the two sign-in methods. Magic link stays
 * the default/primary path (what most emails and bookmarks point people to);
 * password is a clearly-labeled fallback for when Supabase rate-limits the
 * magic-link email and the owner is otherwise locked out.
 */
export function LoginMethodSwitcher({ error, next }: LoginMethodSwitcherProps) {
  const [method, setMethod] = useState<"magic-link" | "password">("magic-link")

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <p className="text-sm text-destructive text-center">
          {error === "callback_failed"
            ? "The link has expired or is invalid. Please request a new one."
            : error === "not_allowed"
              ? "This email isn't authorized for admin access."
              : error}
        </p>
      )}

      {method === "magic-link" ? (
        <>
          <p className="text-sm text-muted-foreground -mt-2">
            Enter your email to receive a magic link.
          </p>
          <MagicLinkForm next={next} />
          <button
            type="button"
            onClick={() => setMethod("password")}
            className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2 text-center"
          >
            Sign in with a password instead
          </button>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground -mt-2">
            Enter your email and password.
          </p>
          <PasswordLoginForm next={next} />
          <button
            type="button"
            onClick={() => setMethod("magic-link")}
            className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2 text-center"
          >
            Back to magic link sign-in
          </button>
        </>
      )}
    </div>
  )
}
