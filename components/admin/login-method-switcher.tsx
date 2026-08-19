"use client"

import { useState } from "react"
import { MagicLinkForm } from "@/components/admin/magic-link-form"
import { PasswordLoginForm } from "@/components/admin/password-login-form"
import { PasskeySignInButton } from "@/components/admin/passkey-sign-in-button"
import { useBrowserSupportsPasskeys } from "@/lib/passkeys"

interface LoginMethodSwitcherProps {
  error?: string
  next?: string
}

/**
 * Toggles the login card between the two sign-in methods. PASSWORD is the
 * default: the magic-link email is rate-limited by Supabase and repeatedly
 * locked the owner out ("nothing happens, wait a few minutes"), which is the
 * whole reason password sign-in exists. Magic link stays one click away for
 * anyone who hasn't set a password yet.
 *
 * The passkey button (Face ID / fingerprint / Windows Hello) sits above both
 * — it self-hides on browsers/devices without WebAuthn support, and every
 * failure path falls straight through to whichever method is showing below.
 */
export function LoginMethodSwitcher({ error, next }: LoginMethodSwitcherProps) {
  const [method, setMethod] = useState<"magic-link" | "password">("password")

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

      <PasskeySignInButtonWithDivider next={next} />

      {method === "magic-link" ? (
        <>
          <p className="text-sm text-muted-foreground -mt-2">
            Enter your email to receive a magic link.
          </p>
          <MagicLinkForm next={next} />
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
              or
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>
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
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
              or
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>
          <button
            type="button"
            onClick={() => setMethod("magic-link")}
            className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2 text-center"
          >
            Email me a magic link instead
          </button>
        </>
      )}
    </div>
  )
}

/** Passkey button + its own "or" divider — both hidden together on browsers
 *  without WebAuthn support, feature-detected on mount (no SSR mismatch). */
function PasskeySignInButtonWithDivider({ next }: { next?: string }) {
  const supported = useBrowserSupportsPasskeys()

  if (!supported) return null

  return (
    <div className="flex flex-col gap-6">
      <PasskeySignInButton next={next} />
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
          or
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  )
}
