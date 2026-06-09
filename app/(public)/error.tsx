"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="max-w-7xl mx-auto px-6 md:px-10 py-20 md:py-32 flex flex-col items-center text-center">
      <p className="text-xs uppercase tracking-[0.2em] font-medium text-muted-foreground mb-3">
        Error
      </p>
      <h1 className="text-3xl md:text-5xl tracking-tight font-light font-serif mb-4">
        Something went wrong
      </h1>
      <p className="text-base text-muted-foreground mb-8 max-w-md">
        An unexpected error occurred. Try reloading the page — if the problem
        persists, please get in touch.
      </p>
      <Button onClick={reset} variant="outline">
        Try again
      </Button>
    </div>
  )
}
