"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { createContact, updateContact } from "@/lib/actions/contacts"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FormField } from "@/components/admin/form-field"
import type { Contact } from "@/lib/types"

interface ContactFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contact?: Contact
}

export function ContactFormDialog({
  open,
  onOpenChange,
  contact,
}: ContactFormDialogProps) {
  const isEdit = !!contact

  const [email, setEmail] = useState(contact?.email ?? "")
  const [first_name, setFirstName] = useState(contact?.first_name ?? "")
  const [last_name, setLastName] = useState(contact?.last_name ?? "")
  const [source, setSource] = useState(contact?.source ?? "manual")
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  function validate() {
    const errs: Record<string, string> = {}
    if (!email.trim()) errs.email = "Email is required"
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errs.email = "Valid email required"
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSave() {
    if (!validate()) return
    setSaving(true)
    try {
      const input = {
        email,
        first_name: first_name || null,
        last_name: last_name || null,
        source: source || "manual",
      }
      const result = isEdit
        ? await updateContact(contact.id, input)
        : await createContact(input)

      if (!result.ok) {
        toast.error(result.error)
      } else {
        toast.success(isEdit ? "Contact saved" : "Contact added")
        onOpenChange(false)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit contact" : "Add contact"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <FormField label="Email" required error={errors.email}>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              type="email"
              disabled={isEdit}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="First name">
              <Input
                value={first_name}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First"
              />
            </FormField>
            <FormField label="Last name">
              <Input
                value={last_name}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last"
              />
            </FormField>
          </div>

          <FormField label="Source">
            <Input
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="manual, website, event…"
            />
          </FormField>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            {saving ? "Saving…" : isEdit ? "Save" : "Add contact"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
