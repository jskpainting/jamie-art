"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { generateNewsletter } from "@/lib/actions/ai"

type Tone = "warm" | "short" | "playful"

const TONES: { value: Tone; label: string }[] = [
  { value: "warm", label: "Warm" },
  { value: "short", label: "Short" },
  { value: "playful", label: "Playful" },
]

interface WriteNewsletterCardProps {
  aiConfigured: boolean
  hasExistingBody: boolean
  onGenerated: (result: { subject: string; body: string }) => void
}

export function WriteNewsletterCard({ aiConfigured, hasExistingBody, onGenerated }: WriteNewsletterCardProps) {
  const [request, setRequest] = useState("")
  const [includeNewPaintings, setIncludeNewPaintings] = useState(true)
  const [includeEvents, setIncludeEvents] = useState(true)
  const [tone, setTone] = useState<Tone>("warm")
  const [loading, setLoading] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingResult, setPendingResult] = useState<{ subject: string; body: string } | null>(null)
  const [hasGenerated, setHasGenerated] = useState(false)

  async function runGenerate() {
    if (!request.trim()) {
      toast.error("Tell it what the email should say first", { duration: 5000 })
      return
    }
    setLoading(true)
    try {
      const result = await generateNewsletter({
        request,
        includeNewPaintings,
        includeEvents,
        tone,
      })
      if (!result.ok) {
        toast.error(result.error, { duration: 5000 })
        return
      }
      const generated = { subject: result.subject ?? "", body: result.body ?? "" }
      if (hasExistingBody) {
        setPendingResult(generated)
        setConfirmOpen(true)
      } else {
        onGenerated(generated)
        setHasGenerated(true)
        toast.success("Draft written — take a look below", { duration: 5000 })
      }
    } catch {
      toast.error("Something went wrong generating the draft", { duration: 5000 })
    } finally {
      setLoading(false)
    }
  }

  function confirmReplace() {
    if (pendingResult) {
      onGenerated(pendingResult)
      setHasGenerated(true)
      toast.success("Draft written — take a look below", { duration: 5000 })
    }
    setPendingResult(null)
    setConfirmOpen(false)
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-medium text-base">Write it for me</h2>
      </div>

      {!aiConfigured ? (
        <p className="text-sm text-muted-foreground">
          To use this, add a free Gemini or Groq key — see the setup note in the project (docs/AI_SETUP.md).
        </p>
      ) : (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="nl-ai-request">What should this email say?</Label>
            <textarea
              id="nl-ai-request"
              value={request}
              onChange={(e) => setRequest(e.target.value)}
              placeholder={
                "e.g. \"Announce the three new fall pieces and the October show\" or \"Just a short hello, nothing new to share\""
              }
              rows={3}
              maxLength={1000}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
            />
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={includeNewPaintings} onCheckedChange={(v) => setIncludeNewPaintings(v === true)} />
              Include my newest paintings with photos
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={includeEvents} onCheckedChange={(v) => setIncludeEvents(v === true)} />
              Include upcoming shows
            </label>
          </div>

          <div className="space-y-1.5">
            <Label>Tone</Label>
            <div className="inline-flex rounded-md border border-input p-0.5">
              {TONES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTone(t.value)}
                  className={cn(
                    "rounded-sm px-3 py-1 text-xs font-medium transition-colors",
                    tone === t.value
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Button onClick={runGenerate} disabled={loading} className="gap-2">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Writing…" : "Generate"}
            </Button>
            {hasGenerated && !loading && (
              <button
                type="button"
                onClick={runGenerate}
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                Try again
              </button>
            )}
          </div>
        </>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-sm" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Replace what you&rsquo;ve written?</DialogTitle>
            <DialogDescription>
              You already have a subject or body typed in. Generating a new draft will replace it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmReplace}>Replace</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
