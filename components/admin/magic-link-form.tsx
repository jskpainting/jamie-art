"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

const schema = z.object({
  email: z.string().email("Enter a valid email address"),
})

type FormValues = z.infer<typeof schema>

interface MagicLinkFormProps {
  error?: string
  next?: string
}

export function MagicLinkForm({ error, next }: MagicLinkFormProps) {
  const [sent, setSent] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    getValues,
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  // Countdown timer after a successful send
  useEffect(() => {
    if (cooldown <= 0) return
    const id = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000)
    return () => clearInterval(id)
  }, [cooldown])

  async function sendLink(email: string) {
    const supabase = createClient()
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next ?? "/admin")}`
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    })
    if (otpError) {
      toast.error("Failed to send link. Please try again.")
      return false
    }
    return true
  }

  async function onSubmit(values: FormValues) {
    const ok = await sendLink(values.email)
    if (ok) {
      toast.success("Check your email for the magic link.")
      setSent(true)
      setCooldown(60)
    }
  }

  async function handleResend() {
    const email = getValues("email")
    const ok = await sendLink(email)
    if (ok) {
      toast.success("Link resent — check your inbox.")
      setCooldown(60)
    }
  }

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

      {sent ? (
        <div className="flex flex-col gap-4 text-center">
          <p className="text-sm text-muted-foreground leading-relaxed">
            A magic link has been sent to{" "}
            <span className="font-medium text-foreground">
              {getValues("email")}
            </span>
            . Click the link in your email to sign in.
          </p>
          <Button
            variant="outline"
            onClick={handleResend}
            disabled={cooldown > 0}
            className="w-full"
          >
            {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend link"}
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              placeholder="jamie@example.com"
              autoComplete="email"
              autoFocus
              {...register("email")}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Sending…" : "Send magic link"}
          </Button>
        </form>
      )}
    </div>
  )
}
