"use client"

import { useMemo, useState, useSyncExternalStore } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { MessageSquare } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ARTIST_NAME } from "@/lib/site"
import { SITE_COPY_DEFAULTS, fillInquiryTemplate } from "@/lib/site-copy"
import type { Painting, Settings } from "@/lib/types"

const schema = z.object({
  from_name: z.string().min(1, "Name is required"),
  from_email: z.string().email("Valid email required"),
})

type FormValues = z.infer<typeof schema>

interface InquireDialogProps {
  painting: Painting
  settings?: Settings | null
  className?: string
}

/** Strip everything except digits and a leading "+" (E.164-ish cleanup for sms:). */
function phoneForSms(phone: string): string {
  const trimmed = phone.trim()
  const plus = trimmed.startsWith("+") ? "+" : ""
  return plus + trimmed.replace(/\D/g, "")
}

/**
 * iOS wants `sms:+1555…&body=…`, Android wants `sms:+1555…?body=…`. Detect iOS
 * (including modern iPadOS, which reports as "MacIntel" but has touch) without
 * relying on brittle UA-string sniffing beyond the documented gotcha.
 */
export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false
  if (/iP(hone|ad|od)/.test(navigator.platform)) return true
  const uaDataPlatform = (
    navigator as Navigator & { userAgentData?: { platform?: string } }
  ).userAgentData?.platform
  if (uaDataPlatform && /iOS|iPadOS/i.test(uaDataPlatform)) return true
  // iPadOS 13+ reports as "MacIntel" but (unlike a real Mac) supports touch.
  if (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) return true
  return false
}

/** Build a platform-correct `sms:` deep link with the message pre-filled. */
export function buildSmsHref(phone: string, body: string, iOS: boolean): string {
  const separator = iOS ? "&" : "?"
  return `sms:${phoneForSms(phone)}${separator}body=${encodeURIComponent(body)}`
}

function subscribeCoarsePointer(onChange: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {}
  const mq = window.matchMedia("(pointer: coarse)")
  mq.addEventListener("change", onChange)
  return () => mq.removeEventListener("change", onChange)
}
function getCoarsePointerSnapshot() {
  return typeof window !== "undefined" && !!window.matchMedia
    ? window.matchMedia("(pointer: coarse)").matches
    : true
}
// Server/first-paint default: "shown" — if in doubt, show it, it degrades harmlessly.
function getCoarsePointerServerSnapshot() {
  return true
}

export function InquireDialog({ painting, settings, className }: InquireDialogProps) {
  const [open, setOpen] = useState(false)
  const coarsePointer = useSyncExternalStore(
    subscribeCoarsePointer,
    getCoarsePointerSnapshot,
    getCoarsePointerServerSnapshot
  )

  const template =
    settings?.inquiry_message_template ?? SITE_COPY_DEFAULTS.inquiry_message_template
  const initialMessage = useMemo(
    () => fillInquiryTemplate(template, { painting: painting.title, artist: ARTIST_NAME }),
    [template, painting.title]
  )
  const [message, setMessage] = useState(initialMessage)

  // Re-seed the message every time the sheet is opened (picks up any edits
  // discarded on a prior open, and any admin template changes since) —
  // handled at the point of opening rather than via an effect.
  function openDialog() {
    setMessage(initialMessage)
    setOpen(true)
  }

  const phone = settings?.phone ?? null
  const smsEnabled = settings?.inquiry_sms_enabled !== false
  const smsEligible = Boolean(phone) && smsEnabled && coarsePointer

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  function handleSendText() {
    if (!phone) return
    const href = buildSmsHref(phone, message, isIOS())
    window.location.href = href
    setOpen(false)
  }

  async function onSubmit(values: FormValues) {
    try {
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, message, painting_id: painting.id }),
      })
      if (res.ok) {
        toast.success("Message sent! Jamie will be in touch soon.")
        reset()
        setTimeout(() => setOpen(false), 1000)
      } else {
        toast.error("Something went wrong. Please try again.")
      }
    } catch {
      toast.error("Something went wrong. Please try again.")
    }
  }

  return (
    <>
      <Button onClick={openDialog} className={className}>
        Ask about this painting
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ask about this painting</DialogTitle>
            <DialogDescription>
              Send Jamie a note about &ldquo;{painting.title}&rdquo;. You&rsquo;ll
              hear back within a few days.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 mt-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inquiry-message">Your message</Label>
              <Textarea
                id="inquiry-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="min-h-[100px] resize-none"
              />
            </div>

            {smsEligible && phone && (
              <>
                <button
                  type="button"
                  onClick={handleSendText}
                  className="flex items-center justify-center gap-2 h-11 px-4 rounded-full bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  <MessageSquare className="h-4 w-4" />
                  Send as a text
                </button>

                <div className="relative flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="h-px flex-1 bg-border" />
                  or send through the website
                  <span className="h-px flex-1 bg-border" />
                </div>
              </>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="from_name">Your name</Label>
                <Input
                  id="from_name"
                  placeholder="Jane Smith"
                  {...register("from_name")}
                />
                {errors.from_name && (
                  <p className="text-xs text-destructive">{errors.from_name.message}</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="from_email">Email address</Label>
                <Input
                  id="from_email"
                  type="email"
                  placeholder="jane@example.com"
                  {...register("from_email")}
                />
                {errors.from_email && (
                  <p className="text-xs text-destructive">{errors.from_email.message}</p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting
                    ? "Sending…"
                    : smsEligible
                      ? "Send through the website"
                      : "Send message"}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
