"use client"

// This component is always imported with { ssr: false } (see commission/page.tsx)
// so window is guaranteed to be defined on first render — lazy initialisers are safe.

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { submitCommissionInquiry } from "@/lib/actions/commission"
import { getPrefill, savePrefill } from "@/lib/form-prefill"

interface CommissionFormProps {
  initialPainting?: string
  initialPaintingId?: string
}

export function CommissionForm({
  initialPainting,
  initialPaintingId,
}: CommissionFormProps) {
  const [name, setName] = useState<string>(() => getPrefill().name ?? "")
  const [email, setEmail] = useState<string>(() => getPrefill().email ?? "")
  const [phone, setPhone] = useState<string>(() => getPrefill().phone ?? "")
  const [message, setMessage] = useState("")
  const [paintingRef, setPaintingRef] = useState(initialPainting ?? "")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const result = await submitCommissionInquiry({
        from_name: name || null,
        from_email: email,
        from_phone: phone || null,
        message,
        reference_painting_title: paintingRef || null,
        reference_painting_id: initialPaintingId || null,
      })
      if (!result.ok) {
        setError(result.error ?? "Something went wrong.")
        return
      }
      savePrefill({ name: name || undefined, email: email || undefined, phone: phone || undefined })
      setSuccess(true)
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="py-10 text-center">
        <p className="font-serif text-2xl font-light mb-3">Thank you</p>
        <p className="text-muted-foreground">
          Thanks — Jamie will be in touch.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">
            Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">
            Email <span className="text-destructive">*</span>
          </Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="phone">Phone (optional)</Label>
        <Input
          id="phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+1 555 000 0000"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="painting_ref">Painting reference (optional)</Label>
        <Input
          id="painting_ref"
          value={paintingRef}
          onChange={(e) => setPaintingRef(e.target.value)}
          placeholder="e.g. Coastal Morning, 2023"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="message">
          Message <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="message"
          required
          minLength={10}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Tell Jamie what you have in mind — size, subject, palette, where it'll live…"
          className="min-h-[140px] resize-none"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
        {submitting ? "Sending…" : "Send message"}
      </Button>
    </form>
  )
}
