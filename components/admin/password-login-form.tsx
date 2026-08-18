"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { safeNext } from "@/lib/safe-next"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

const schema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
})

type FormValues = z.infer<typeof schema>

interface PasswordLoginFormProps {
  next?: string
}

export function PasswordLoginForm({ next }: PasswordLoginFormProps) {
  const router = useRouter()
  const [cooldown, setCooldown] = useState(0)
  const [resetSent, setResetSent] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    getValues,
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (cooldown <= 0) return
    const id = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000)
    return () => clearInterval(id)
  }, [cooldown])

  async function onSubmit(values: FormValues) {
    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    })

    if (error) {
      const status = (error as { status?: number }).status
      const msg = (error.message || "").toLowerCase()
      if (status === 429 || msg.includes("rate") || msg.includes("too many")) {
        toast.error(
          "Too many attempts right now — please wait about a minute, then try again."
        )
        setCooldown(60)
      } else if (
        msg.includes("invalid login credentials") ||
        msg.includes("invalid credentials") ||
        status === 400
      ) {
        // Never reveal whether the email exists — same message either way.
        toast.error("That email or password isn't right.")
      } else {
        toast.error(error.message || "Couldn't sign in. Please try again.")
      }
      return
    }

    // Belt-and-suspenders allowlist check on the client. The server-side
    // gate (lib/supabase/auth.ts getUser(), proxy.ts) is what actually
    // protects every admin route and page — this just gives a clean error
    // and signs the non-admin user back out immediately, mirroring the
    // magic-link callback's behavior, instead of bouncing them through a
    // protected page first.
    const email = data.user?.email
    const allowed = await fetch("/admin/auth/check-allowed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })
      .then((r) => r.json())
      .catch(() => ({ allowed: false }))

    if (!allowed?.allowed) {
      await supabase.auth.signOut()
      toast.error("This email isn't authorized for admin access.")
      return
    }

    router.push(safeNext(next))
    router.refresh()
  }

  async function handleForgotPassword() {
    const email = getValues("email")
    const parsed = z.string().email().safeParse(email)
    if (!parsed.success) {
      toast.error("Enter your email address above first, then try again.")
      return
    }
    const supabase = createClient()
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/admin/account")}`
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    })
    if (error) {
      const status = (error as { status?: number }).status
      const msg = (error.message || "").toLowerCase()
      if (status === 429 || msg.includes("rate") || msg.includes("too many")) {
        toast.error(
          "Too many requests right now — please wait about a minute, then try again."
        )
        setCooldown(60)
        return
      }
      // Never reveal whether the email exists.
      toast.error(error.message || "Couldn't send the reset link. Please try again.")
      return
    }
    setResetSent(true)
    toast.success("If that email has admin access, a reset link is on its way.")
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pw-email">Email address</Label>
        <Input
          id="pw-email"
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

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="pw-password">Password</Label>
          <button
            type="button"
            onClick={handleForgotPassword}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            Forgot password?
          </button>
        </div>
        <Input
          id="pw-password"
          type="password"
          placeholder="••••••••••"
          autoComplete="current-password"
          {...register("password")}
        />
        {errors.password && (
          <p className="text-xs text-destructive">{errors.password.message}</p>
        )}
      </div>

      {resetSent && (
        <p className="text-xs text-muted-foreground leading-relaxed">
          If that email has admin access, a reset link is on its way — check
          your inbox.
        </p>
      )}

      <Button
        type="submit"
        disabled={isSubmitting || cooldown > 0}
        className="w-full"
      >
        {cooldown > 0
          ? `Try again in ${cooldown}s`
          : isSubmitting
            ? "Signing in…"
            : "Sign in with password"}
      </Button>
    </form>
  )
}
