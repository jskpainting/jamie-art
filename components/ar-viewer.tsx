"use client"

import { createElement, useEffect, useState } from "react"

interface ArViewerProps {
  /** Public URL of the painting's .glb model. */
  src: string
  alt: string
}

/**
 * "View on my wall" — lazy-loads Google's <model-viewer> only when the visitor
 * asks for it (the library is ~1MB, so we never ship it on initial page load).
 * On a phone the AR button launches the built-in AR: iOS AR Quick Look (which
 * model-viewer generates a USDZ for on the fly) or Android Scene Viewer, placing
 * the painting on a wall at its real size. On desktop it's a rotatable 3D preview.
 */
export function ArViewer({ src, alt }: ArViewerProps) {
  const [open, setOpen] = useState(false)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!open || ready) return
    let active = true
    import("@google/model-viewer")
      .then(() => active && setReady(true))
      .catch(() => active && setFailed(true))
    return () => {
      active = false
    }
  }, [open, ready])

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium hover:bg-muted transition-colors"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 2 3 7v10l9 5 9-5V7z" />
          <path d="M3 7l9 5 9-5" />
          <path d="M12 12v10" />
        </svg>
        View on my wall
      </button>
    )
  }

  if (failed) {
    return (
      <p className="text-sm text-muted-foreground">
        Couldn&rsquo;t load the 3D viewer. Please try again.
      </p>
    )
  }

  if (!ready) {
    return (
      <div className="flex h-[60vh] max-h-[520px] items-center justify-center rounded-2xl border border-border bg-muted/30 text-sm text-muted-foreground">
        Loading 3D preview…
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {createElement(
        "model-viewer",
        {
          src,
          alt,
          ar: true,
          "ar-modes": "webxr scene-viewer quick-look",
          "ar-placement": "wall",
          "camera-controls": true,
          "touch-action": "pan-y",
          "shadow-intensity": "0.6",
          exposure: "1",
          style: {
            width: "100%",
            height: "60vh",
            maxHeight: "520px",
            borderRadius: "1rem",
            background: "transparent",
          },
        },
        createElement(
          "button",
          {
            slot: "ar-button",
            className:
              "absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background shadow-lg",
          },
          "View in your space"
        )
      )}
      <p className="text-xs text-muted-foreground text-center">
        On a phone, tap <span className="font-medium">View in your space</span>{" "}
        and point your camera at a wall — the painting appears at its real size.
        On a computer, drag to rotate.
      </p>
    </div>
  )
}
