"use client"

import { useState, cloneElement, isValidElement } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface ConfirmDialogProps {
  trigger: React.ReactNode
  title: string
  description: string
  onConfirm: () => Promise<void>
  destructive?: boolean
  confirmLabel?: string
}

export function ConfirmDialog({
  trigger,
  title,
  description,
  onConfirm,
  destructive = false,
  confirmLabel = "Confirm",
}: ConfirmDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleConfirm() {
    setLoading(true)
    try {
      await onConfirm()
    } catch (err) {
      toast.error(
        err instanceof Error && err.message
          ? err.message
          : "Something went wrong. Please try again.",
        { duration: 5000 }
      )
    } finally {
      setLoading(false)
      setOpen(false)
    }
  }

  const triggerWithClick = isValidElement(trigger)
    ? cloneElement(
        trigger as React.ReactElement<{ onClick?: (e: unknown) => void }>,
        {
          onClick: (e: unknown) => {
            const props = (trigger as React.ReactElement<{ onClick?: (e: unknown) => void }>).props
            props.onClick?.(e)
            setOpen(true)
          },
        }
      )
    : <span onClick={() => setOpen(true)}>{trigger}</span>

  return (
    <>
      {triggerWithClick}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant={destructive ? "destructive" : "default"}
              onClick={handleConfirm}
              disabled={loading}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {loading ? "Working…" : confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
