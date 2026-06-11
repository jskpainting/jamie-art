"use client"

// This component is always imported with { ssr: false } (see commission/page.tsx)
// so window is guaranteed to be defined on first render — lazy initialisers are safe.

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { submitCommissionInquiry } from "@/lib/actions/commission"
import { getPrefill, savePrefill } from "@/lib/form-prefill"

const schema = z.object({
  name:        z.string().min(1, "Name is required"),
  email:       z.string().email("Valid email required"),
  phone:       z.string().optional(),
  paintingRef: z.string().optional(),
  message:     z.string().min(10, "Message must be at least 10 characters"),
})

type FormValues = z.infer<typeof schema>

interface CommissionFormProps {
  initialPainting?: string
  initialPaintingId?: string
}

export function CommissionForm({
  initialPainting,
  initialPaintingId,
}: CommissionFormProps) {
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name:        getPrefill().name  ?? "",
      email:       getPrefill().email ?? "",
      phone:       getPrefill().phone ?? "",
      paintingRef: initialPainting   ?? "",
      message:     "",
    },
  })

  async function onSubmit(values: FormValues) {
    setServerError(null)
    setSubmitting(true)
    try {
      const result = await submitCommissionInquiry({
        from_name:                values.name  || null,
        from_email:               values.email,
        from_phone:               values.phone || null,
        message:                  values.message,
        reference_painting_title: values.paintingRef || null,
        reference_painting_id:    initialPaintingId  || null,
      })
      if (!result.ok) {
        setServerError(result.error ?? "Something went wrong.")
        return
      }
      const v = getValues()
      savePrefill({
        name:  v.name  || undefined,
        email: v.email || undefined,
        phone: v.phone || undefined,
      })
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
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">
            Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            placeholder="Your name"
            {...register("name")}
          />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">
            Email <span className="text-destructive">*</span>
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            {...register("email")}
          />
          {errors.email && (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="phone">Phone (optional)</Label>
        <Input
          id="phone"
          type="tel"
          placeholder="+1 555 000 0000"
          {...register("phone")}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="painting_ref">Painting reference (optional)</Label>
        <Input
          id="painting_ref"
          placeholder="e.g. Coastal Morning, 2023"
          {...register("paintingRef")}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="message">
          Message <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="message"
          placeholder="Tell Jamie what you have in mind — size, subject, palette, where it'll live…"
          className="min-h-[140px] resize-none"
          {...register("message")}
        />
        {errors.message && (
          <p className="text-xs text-destructive">{errors.message.message}</p>
        )}
      </div>

      {serverError && <p className="text-sm text-destructive">{serverError}</p>}

      <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
        {submitting ? "Sending…" : "Send message"}
      </Button>
    </form>
  )
}
