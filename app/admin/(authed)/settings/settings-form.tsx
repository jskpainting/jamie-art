"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  SettingsSchema,
  type SettingsInput,
  type SettingsFormValues,
} from "@/lib/schemas"
import { updateSettings } from "@/lib/actions/settings"
import type { Settings } from "@/lib/types"

interface SettingsFormProps {
  initialValues: Settings | null
}

export function SettingsForm({ initialValues }: SettingsFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<SettingsFormValues, unknown, SettingsInput>({
    resolver: zodResolver(SettingsSchema),
    defaultValues: {
      phone: initialValues?.phone ?? "",
      email: initialValues?.email ?? "",
      instagram_handle: initialValues?.instagram_handle ?? "",
      newsletter_from_name: initialValues?.newsletter_from_name ?? "",
    },
  })

  async function onSubmit(values: SettingsInput) {
    const result = await updateSettings(values)
    if (result.ok) {
      toast.success("Settings saved.", { duration: 5000 })
    } else {
      toast.error(result.error ?? "Failed to save settings.", { duration: 5000 })
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      {/* Phone */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="phone">Phone</Label>
        <Input
          id="phone"
          type="tel"
          placeholder="+15551234567"
          {...register("phone")}
        />
        <p className="text-xs text-muted-foreground">
          E.164 format — country code followed by number, no spaces or dashes.
        </p>
        {errors.phone && (
          <p className="text-xs text-destructive">{errors.phone.message}</p>
        )}
      </div>

      {/* Email */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="hello@jamiekendrioski.com"
          {...register("email")}
        />
        {errors.email && (
          <p className="text-xs text-destructive">{errors.email.message}</p>
        )}
      </div>

      {/* Instagram handle */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="instagram_handle">
          Instagram handle{" "}
          <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <div className="flex items-center">
          <span className="flex h-9 items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground select-none">
            @
          </span>
          <Input
            id="instagram_handle"
            placeholder="jamiekendrioski"
            className="rounded-l-none"
            {...register("instagram_handle")}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Handle only — no @ prefix stored. Leave blank to hide the Instagram link in the footer.
        </p>
        {errors.instagram_handle && (
          <p className="text-xs text-destructive">{errors.instagram_handle.message}</p>
        )}
      </div>

      {/* Newsletter from-name */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="newsletter_from_name">
          Newsletter from-name{" "}
          <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Input
          id="newsletter_from_name"
          placeholder="Jamie Kendrioski"
          {...register("newsletter_from_name")}
        />
        <p className="text-xs text-muted-foreground">
          Shown as the sender name in newsletter emails when Resend integration ships.
        </p>
        {errors.newsletter_from_name && (
          <p className="text-xs text-destructive">{errors.newsletter_from_name.message}</p>
        )}
      </div>

      <div className="pt-2">
        <Button type="submit" disabled={isSubmitting || !isDirty}>
          {isSubmitting ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </form>
  )
}
