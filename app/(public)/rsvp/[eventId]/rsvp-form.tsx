"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Minus, Plus, Check, HelpCircle, X as XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"

type Answer = "yes" | "no" | "maybe"

interface InviteInfo {
  id: string
  name: string | null
  email: string
  status: "invited" | Answer
  guests: number
}

interface RsvpFormProps {
  eventId: string
  token: string | null
  rsvpNote: string | null
  invite: InviteInfo | null
}

export function RsvpForm({ eventId, token, rsvpNote, invite }: RsvpFormProps) {
  const firstName = invite?.name?.trim().split(/\s+/)[0] || null
  const alreadyAnswered = !!invite && invite.status !== "invited"

  const [status, setStatus] = useState<Answer | null>(
    alreadyAnswered ? (invite!.status as Answer) : null
  )
  const [guests, setGuests] = useState(invite?.guests ?? 1)
  const [submitted, setSubmitted] = useState(alreadyAnswered)
  const [changing, setChanging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [keepMePosted, setKeepMePosted] = useState(false)
  const [website, setWebsite] = useState("") // honeypot — left empty by real visitors
  const [errors, setErrors] = useState<Record<string, string>>({})

  const showForm = !submitted || changing

  async function submit(nextStatus: Answer, nextGuests: number) {
    if (!token) {
      const errs: Record<string, string> = {}
      if (!name.trim()) errs.name = "Name is required"
      if (!email.trim()) errs.email = "Email is required"
      setErrors(errs)
      if (Object.keys(errs).length > 0) return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          token: token ?? undefined,
          name: token ? undefined : name.trim(),
          email: token ? undefined : email.trim(),
          status: nextStatus,
          guests: nextGuests,
          keepMePosted: token ? undefined : keepMePosted,
          website,
        }),
      })
      const json = await res.json().catch(() => ({}))

      if (res.ok && json.ok) {
        setStatus(nextStatus)
        setGuests(nextGuests)
        setSubmitted(true)
        setChanging(false)
        return
      }

      const reason = json.reason as string | undefined
      if (reason === "full") {
        toast.error("Sorry — this event is full.")
      } else if (reason === "past" || reason === "disabled") {
        toast.error("RSVPs are no longer open for this event.")
      } else {
        toast.error("Something went wrong. Please try again.")
      }
    } catch {
      toast.error("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  function handleYes() {
    void submit("yes", guests)
  }

  function handleNo() {
    void submit("no", 1)
  }

  function handleMaybe() {
    void submit("maybe", 1)
  }

  function adjustGuests(delta: number) {
    const next = Math.min(10, Math.max(1, guests + delta))
    setGuests(next)
    void submit("yes", next)
  }

  if (!showForm && status) {
    return (
      <div className="rounded-2xl border border-border p-6 md:p-8">
        <div className="flex items-center gap-2 mb-2">
          {status === "yes" ? (
            <Check className="h-5 w-5 text-accent" />
          ) : status === "maybe" ? (
            <HelpCircle className="h-5 w-5 text-muted-foreground" />
          ) : (
            <XIcon className="h-5 w-5 text-muted-foreground" />
          )}
          <p className="font-serif text-xl font-light">
            {status === "yes"
              ? "You're on the list"
              : status === "no"
                ? "Thanks for letting us know"
                : "Maybe — we'll keep a spot warm"}
          </p>
        </div>
        {status === "yes" && (
          <div className="flex items-center gap-3 mt-4">
            <p className="text-sm text-muted-foreground">
              {guests === 1 ? "Just you" : `You + ${guests - 1} guest${guests > 2 ? "s" : ""}`}
            </p>
            <div className="flex items-center gap-1 ml-auto">
              <button
                type="button"
                onClick={() => adjustGuests(-1)}
                disabled={loading || guests <= 1}
                aria-label="Fewer guests"
                className="h-8 w-8 rounded-full border border-border flex items-center justify-center disabled:opacity-40 hover:bg-muted transition-colors"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-6 text-center text-sm">{guests}</span>
              <button
                type="button"
                onClick={() => adjustGuests(1)}
                disabled={loading || guests >= 10}
                aria-label="More guests"
                className="h-8 w-8 rounded-full border border-border flex items-center justify-center disabled:opacity-40 hover:bg-muted transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => setChanging(true)}
          className="mt-5 text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
        >
          Change my answer
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <p className="text-base font-serif font-light">
        {firstName ? `Hi ${firstName} — are you coming?` : "Will you be joining us?"}
      </p>

      {rsvpNote && (
        <p className="text-sm text-muted-foreground leading-relaxed">{rsvpNote}</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Button
          onClick={handleYes}
          disabled={loading}
          className="h-12 w-full text-base"
        >
          Yes, I&rsquo;ll be there
        </Button>
        <Button
          onClick={handleMaybe}
          disabled={loading}
          variant="outline"
          className="h-12 w-full text-base"
        >
          Maybe
        </Button>
        <Button
          onClick={handleNo}
          disabled={loading}
          variant="outline"
          className="h-12 w-full text-base"
        >
          Can&rsquo;t make it
        </Button>
      </div>

      {!token && (
        <div className="space-y-4 pt-2">
          {/* Honeypot — hidden from real visitors, only a bot fills this in. */}
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            className="absolute left-[-9999px] h-0 w-0 opacity-0"
          />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rsvp-name">Your name</Label>
            <Input
              id="rsvp-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Smith"
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rsvp-email">Email address</Label>
            <Input
              id="rsvp-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@example.com"
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>
          <label className={cn("flex items-start gap-2.5")}>
            <Checkbox
              checked={keepMePosted}
              onCheckedChange={(checked) => setKeepMePosted(checked === true)}
              className="mt-0.5"
            />
            <span className="text-sm text-muted-foreground">
              Keep me posted about new work and shows
            </span>
          </label>
        </div>
      )}
    </div>
  )
}
