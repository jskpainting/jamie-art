"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { FormField } from "@/components/admin/form-field"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

const MIN_LENGTH = 8

const schema = z
  .object({
    password: z.string().min(MIN_LENGTH, `Must be at least ${MIN_LENGTH} characters`),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  })

type FormValues = z.infer<typeof schema>

export function PasswordForm() {
  const [saving, setSaving] = useState(false)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function onSubmit(values: FormValues) {
    setSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({
        password: values.password,
      })
      if (error) {
        // Plain-language mapping — never surface a raw Supabase error string.
        const status = (error as { status?: number }).status
        const msg = (error.message || "").toLowerCase()
        if (status === 429 || msg.includes("rate") || msg.includes("too many")) {
          toast.error("Too many attempts right now — please wait a minute and try again.", {
            duration: 5000,
          })
        } else if (msg.includes("different from") || msg.includes("same password")) {
          toast.error("Choose a password different from your current one.", {
            duration: 5000,
          })
        } else if (msg.includes("session") || msg.includes("not authenticated")) {
          toast.error("Your session expired — please sign in again.", {
            duration: 5000,
          })
        } else {
          toast.error("Couldn't update the password. Please try again in a moment.", {
            duration: 5000,
          })
        }
        return
      }
      toast.success("Password updated. You can now use it to sign in.", {
        duration: 5000,
      })
      reset()
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-4 max-w-sm"
    >
      <FormField label="New password" error={errors.password?.message} required>
        <Input
          type="password"
          autoComplete="new-password"
          {...register("password")}
        />
        <p className="text-xs text-muted-foreground">
          At least {MIN_LENGTH} characters.
        </p>
      </FormField>

      <FormField
        label="Confirm new password"
        error={errors.confirmPassword?.message}
        required
      >
        <Input
          type="password"
          autoComplete="new-password"
          {...register("confirmPassword")}
        />
      </FormField>

      <Button type="submit" disabled={saving} className="w-fit">
        {saving ? "Saving…" : "Update password"}
      </Button>
    </form>
  )
}
