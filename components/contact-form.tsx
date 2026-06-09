"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"

const schema = z.object({
  from_name: z.string().min(1, "Name is required"),
  from_email: z.string().email("Valid email required"),
  message: z.string().min(1, "Message is required"),
})

type FormValues = z.infer<typeof schema>

export function ContactForm() {
  const [sent, setSent] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function onSubmit(values: FormValues) {
    try {
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
      if (res.ok) {
        toast.success("Message sent! Jamie will be in touch soon.")
        reset()
        setSent(true)
      } else {
        toast.error("Something went wrong. Please try again.")
      }
    } catch {
      toast.error("Something went wrong. Please try again.")
    }
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-border p-8 text-center">
        <p className="font-serif text-xl font-light mb-2">Thank you</p>
        <p className="text-sm text-muted-foreground">
          Your message has been sent. Jamie will be in touch soon.
        </p>
        <button
          onClick={() => setSent(false)}
          className="mt-4 text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
        >
          Send another message
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="from_name">Your name</Label>
        <Input id="from_name" placeholder="Jane Smith" {...register("from_name")} />
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

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="message">Message</Label>
        <Textarea
          id="message"
          placeholder="Tell me what's on your mind…"
          className="min-h-[140px] resize-none"
          {...register("message")}
        />
        {errors.message && (
          <p className="text-xs text-destructive">{errors.message.message}</p>
        )}
      </div>

      <Button type="submit" disabled={isSubmitting} className="self-start">
        {isSubmitting ? "Sending…" : "Send message"}
      </Button>
    </form>
  )
}
