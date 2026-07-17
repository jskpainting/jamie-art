"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
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
import type { Painting } from "@/lib/types"

const schema = z.object({
  from_name: z.string().min(1, "Name is required"),
  from_email: z.string().email("Valid email required"),
  message: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface InquireDialogProps {
  painting: Painting
  className?: string
}

export function InquireDialog({ painting, className }: InquireDialogProps) {
  const [open, setOpen] = useState(false)

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
        body: JSON.stringify({ ...values, painting_id: painting.id }),
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
      <Button onClick={() => setOpen(true)} className={className}>
        Inquire about this painting
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Inquire about this painting</DialogTitle>
            <DialogDescription>
              Send Jamie a message about &ldquo;{painting.title}&rdquo;. You&rsquo;ll
              hear back within a few days.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 mt-2">
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

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="message">Message (optional)</Label>
              <Textarea
                id="message"
                placeholder="I'd love to know more about availability and shipping…"
                className="min-h-[100px] resize-none"
                {...register("message")}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Sending…" : "Send message"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
