"use client"

import { useState } from "react"
import { MessageSquare, Mail, MessageCircle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { PaintingWithImages, Settings } from "@/lib/types"

interface PrintRequestDialogProps {
  painting: PaintingWithImages
  settings: Settings | null
  paintingUrl: string
}

function phoneDigitsOnly(phone: string | null | undefined): string {
  return (phone ?? "").replace(/\D/g, "")
}

export function PrintRequestDialog({
  painting,
  settings,
  paintingUrl,
}: PrintRequestDialogProps) {
  const [open, setOpen] = useState(false)

  const body = `Hi Jamie — I'm interested in a print of '${painting.title}' (${paintingUrl}).`
  const encodedBody = encodeURIComponent(body)
  const subject = encodeURIComponent(`Print inquiry: ${painting.title}`)
  const phone = settings?.phone ?? ""
  const email = settings?.email ?? ""
  const waPhone = phoneDigitsOnly(phone)

  const channels = [
    {
      label: "Message (SMS)",
      icon: MessageSquare,
      href: `sms:${phone}?body=${encodedBody}`,
      disabled: !phone,
    },
    {
      label: "Email",
      icon: Mail,
      href: `mailto:${email}?subject=${subject}&body=${encodedBody}`,
      disabled: !email,
    },
    {
      label: "WhatsApp",
      icon: MessageCircle,
      href: `https://wa.me/${waPhone}?text=${encodedBody}`,
      disabled: !waPhone,
    },
  ]

  return (
    <>
      <div className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-[0.2em] font-medium text-muted-foreground">
          Print Available
        </span>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center justify-center h-9 px-4 rounded-lg border border-border bg-background text-sm font-medium hover:bg-muted transition-colors w-fit"
        >
          Request Print
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Request a print</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-1 mb-2">
            Reach out to Jamie directly about a print of &ldquo;{painting.title}&rdquo;.
          </p>
          <div className="flex flex-col gap-3">
            {channels.map(({ label, icon: Icon, href, disabled }) => (
              <a
                key={label}
                href={disabled ? undefined : href}
                aria-disabled={disabled}
                className={
                  disabled
                    ? "flex items-center gap-3 h-12 px-4 rounded-lg border border-border bg-muted text-muted-foreground text-sm font-medium cursor-not-allowed opacity-50"
                    : "flex items-center gap-3 h-12 px-4 rounded-lg border border-border bg-background hover:bg-muted text-sm font-medium transition-colors"
                }
                onClick={disabled ? (e) => e.preventDefault() : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </a>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
