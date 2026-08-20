"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Fingerprint, Loader2 } from "lucide-react"
import {
  registerPasskey,
  listPasskeys,
  useBrowserSupportsPasskeys,
} from "@/lib/passkeys"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

const DISMISS_KEY = "jk_passkey_upsell_dismissed"

interface PasskeyUpsellProps {
  /** `schema-capabilities.ts`'s `passkeys` flag — the webauthn_credentials
   *  table exists. Passed from the server layout so this client component
   *  never has to probe the schema itself. */
  passkeysCapable: boolean
}

/**
 * The owner's actual ask: "there's a sign-in-with-passkey button, why is
 * there no way to CREATE one?" Registration has to stay session-gated (you
 * can only add a passkey to an account you're already in), so the natural
 * place to offer it is right after a normal sign-in. Shows once per browser
 * — "Not now" is remembered in localStorage — and never shows again once the
 * account has at least one passkey.
 */
export function PasskeyUpsell({ passkeysCapable }: PasskeyUpsellProps) {
  const supported = useBrowserSupportsPasskeys()
  const [open, setOpen] = useState(false)
  const [registering, setRegistering] = useState(false)

  useEffect(() => {
    if (!passkeysCapable || !supported) return
    if (typeof window === "undefined") return
    if (window.localStorage.getItem(DISMISS_KEY)) return

    let cancelled = false
    listPasskeys().then((rows) => {
      if (!cancelled && rows.length === 0) setOpen(true)
    })
    return () => {
      cancelled = true
    }
  }, [passkeysCapable, supported])

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISS_KEY, "1")
    } catch {
      // localStorage unavailable (private mode, etc.) — just close for now.
    }
    setOpen(false)
  }

  async function handleSetUp() {
    setRegistering(true)
    try {
      await registerPasskey()
      toast.success("Passkey added — you can sign in with it next time.", {
        duration: 5000,
      })
      dismiss()
    } catch (err) {
      const name = (err as { name?: string } | null)?.name
      // The user cancelling the OS prompt isn't a "no thanks" — close quietly
      // without remembering it, so the offer can come back another day.
      if (name !== "NotAllowedError") {
        toast.error(
          err instanceof Error ? err.message : "Couldn't add a passkey.",
          { duration: 5000 }
        )
      }
      setOpen(false)
    } finally {
      setRegistering(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) dismiss()
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Fingerprint className="h-5 w-5" />
            Sign in faster next time?
          </DialogTitle>
          <DialogDescription>
            Use Face ID, Touch ID, or your fingerprint instead of typing a
            password. You can always set this up later from Account.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={dismiss} disabled={registering}>
            Not now
          </Button>
          <Button onClick={handleSetUp} disabled={registering}>
            {registering && <Loader2 className="h-4 w-4 animate-spin" />}
            {registering ? "Waiting for device…" : "Set it up"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
