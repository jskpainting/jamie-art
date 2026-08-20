"use client"

import { useState } from "react"
import { X } from "lucide-react"

export function DismissibleNotice({ message }: { message: string }) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null
  return (
    <div className="print:hidden mb-4 flex items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
      <span>{message}</span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="shrink-0 rounded p-1 hover:bg-amber-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
