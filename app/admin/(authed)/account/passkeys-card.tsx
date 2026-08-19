"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { format } from "date-fns"
import { Fingerprint, Loader2, Trash2 } from "lucide-react"
import {
  registerPasskey,
  listPasskeys,
  deletePasskey,
  useBrowserSupportsPasskeys,
  type PasskeyRow,
} from "@/lib/passkeys"
import { ConfirmDialog } from "@/components/admin/confirm-dialog"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

/**
 * "Passkeys" card on the Account page. Lists registered passkeys, lets the
 * owner add one (Face ID / Touch ID / Windows Hello / Android fingerprint —
 * an optional device nickname like "Jamie's iPhone") and remove any of them.
 * Deletion is never blocked on "last passkey" — password and magic-link
 * always remain as sign-in methods regardless of how many passkeys exist.
 */
export function PasskeysCard() {
  const [passkeys, setPasskeys] = useState<PasskeyRow[] | null>(null)
  const supported = useBrowserSupportsPasskeys()
  const [addOpen, setAddOpen] = useState(false)
  const [label, setLabel] = useState("")
  const [registering, setRegistering] = useState(false)

  useEffect(() => {
    void refresh()
  }, [])

  async function refresh() {
    const rows = await listPasskeys()
    setPasskeys(rows)
  }

  async function handleRegister() {
    setRegistering(true)
    try {
      await registerPasskey(label.trim() || undefined)
      toast.success("Passkey added.", { duration: 5000 })
      setAddOpen(false)
      setLabel("")
      await refresh()
    } catch (err) {
      const name = (err as { name?: string } | null)?.name
      // NotAllowedError = the user cancelled the OS prompt — quiet, no toast.
      if (name !== "NotAllowedError") {
        toast.error(
          err instanceof Error ? err.message : "Couldn't add a passkey.",
          { duration: 5000 }
        )
      }
    } finally {
      setRegistering(false)
    }
  }

  async function handleDelete(id: string) {
    const ok = await deletePasskey(id)
    if (!ok) {
      toast.error("Couldn't remove that passkey.", { duration: 5000 })
      return
    }
    toast.success("Passkey removed.", { duration: 5000 })
    await refresh()
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
      <div className="flex items-center justify-between gap-4 mb-2">
        <h2 className="text-lg font-medium flex items-center gap-2">
          <Fingerprint className="h-4 w-4" />
          Passkeys
        </h2>
        <Button
          size="sm"
          onClick={() => setAddOpen(true)}
          disabled={!supported}
        >
          Add a passkey
        </Button>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed mb-6">
        Sign in with your face, fingerprint, or screen lock — no password to
        remember.
        {!supported &&
          " This browser or device doesn't support passkeys, but you can still add one from your phone or a device that does."}
      </p>

      {passkeys === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : passkeys.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No passkeys added yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {passkeys.map((pk) => (
            <li
              key={pk.id}
              className="flex items-center justify-between gap-4 rounded-lg border border-border p-3"
            >
              <div>
                <p className="text-sm font-medium">
                  {pk.device_label || "Passkey"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Added{" "}
                  {pk.created_at
                    ? format(new Date(pk.created_at), "MMM d, yyyy")
                    : "—"}
                  {pk.last_used_at &&
                    ` · Last used ${format(new Date(pk.last_used_at), "MMM d, yyyy")}`}
                </p>
              </div>
              <ConfirmDialog
                trigger={
                  <Button variant="outline" size="sm">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                }
                title="Remove this passkey?"
                description="You won't be able to sign in with it anymore. You can always add another later."
                destructive
                onConfirm={() => handleDelete(pk.id)}
              />
            </li>
          ))}
        </ul>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add a passkey</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1.5 py-2">
            <Label htmlFor="passkey-label">Device name (optional)</Label>
            <Input
              id="passkey-label"
              placeholder="Jamie's iPhone"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Your device will ask you to confirm with Face ID, Touch ID, or
              your screen lock.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddOpen(false)}
              disabled={registering}
            >
              Cancel
            </Button>
            <Button onClick={handleRegister} disabled={registering}>
              {registering && (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              )}
              {registering ? "Waiting for device…" : "Continue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
