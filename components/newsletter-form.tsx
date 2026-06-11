"use client"

import { useState } from "react"
import { toast } from "sonner"

interface NewsletterFormProps {
  layout?: "inline" | "stacked"
  placeholder?: string
}

export function NewsletterForm({
  layout = "inline",
  placeholder = "your@email.com",
}: NewsletterFormProps) {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      })
      if (res.ok) {
        toast.success("You're on the list!")
        setEmail("")
      } else {
        toast.error("Something went wrong. Please try again.")
      }
    } catch {
      toast.error("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={
        layout === "inline"
          ? "flex gap-2 w-full"
          : "flex flex-col gap-2 w-full max-w-xs"
      }
      aria-label="Newsletter signup"
    >
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={placeholder}
        required
        className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-base md:text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        aria-label="Email address"
      />
      <button
        type="submit"
        disabled={loading}
        className="h-9 shrink-0 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {loading ? "…" : "Subscribe"}
      </button>
    </form>
  )
}
