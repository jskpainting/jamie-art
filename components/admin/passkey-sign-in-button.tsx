"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Fingerprint, Loader2 } from "lucide-react"
import { authenticateWithPasskey, useBrowserSupportsPasskeys } from "@/lib/passkeys"
import { safeNext } from "@/lib/safe-next"
import { Button } from "@/components/ui/button"

interface PasskeySignInButtonProps {
  next?: string
}

/**
 * Prominent primary "sign in with Face ID / fingerprint" button. Only renders
 * once feature-detected on mount (no SSR mismatch — `useBrowserSupportsPasskeys`
 * is backed by `useSyncExternalStore` so the server snapshot is always
 * `false`). Cancel / NotAllowedError resets silently since that's just the
 * user backing out, not a failure; a genuine ceremony error shows a
 * plain-language toast and leaves password/magic-link right there as the
 * fallback.
 */
export function PasskeySignInButton({ next }: PasskeySignInButtonProps) {
  const router = useRouter()
  const supported = useBrowserSupportsPasskeys()
  const [loading, setLoading] = useState(false)

  if (!supported) return null

  async function handleClick() {
    setLoading(true)
    try {
      const ok = await authenticateWithPasskey()
      if (ok) {
        router.push(safeNext(next))
        router.refresh()
        return
      }
      // null = user cancelled, no matching passkey, or a clean ceremony
      // failure — all handled the same way: quiet reset, no scary error.
    } catch {
      toast.error("Couldn't sign in with a passkey. Please use email or password below.", {
        duration: 5000,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="w-full"
      size="lg"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Fingerprint className="h-4 w-4" />
      )}
      {loading ? "Signing in…" : "Sign in with Face ID or fingerprint"}
    </Button>
  )
}
