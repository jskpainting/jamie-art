"use client"

import { createElement, useEffect, useRef, useState, useSyncExternalStore } from "react"

function subscribeCoarsePointer(onChange: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {}
  const mq = window.matchMedia("(pointer: coarse)")
  mq.addEventListener("change", onChange)
  return () => mq.removeEventListener("change", onChange)
}
function getCoarsePointerSnapshot() {
  return typeof window !== "undefined" && !!window.matchMedia
    ? window.matchMedia("(pointer: coarse)").matches
    : false
}
function getCoarsePointerServerSnapshot() {
  return false
}
/** Feature-detect a coarse pointer (touch) without brittle UA sniffing. */
function useCoarsePointer() {
  return useSyncExternalStore(
    subscribeCoarsePointer,
    getCoarsePointerSnapshot,
    getCoarsePointerServerSnapshot
  )
}

interface ArViewerProps {
  /** Public URL of the painting's .glb model. */
  src: string
  alt: string
  /**
   * True for the `?ar=1` QR-card arrival flow. Opens the viewer immediately
   * (so `@google/model-viewer` and the .glb start loading as soon as
   * possible) and promotes the AR button so it's the obvious next tap.
   */
  promoted?: boolean
}

/**
 * "View on my wall" — lazy-loads Google's <model-viewer> only when the visitor
 * asks for it (the library is ~1MB, so we never ship it on initial page load).
 * On a phone the AR button launches the built-in AR: iOS AR Quick Look (which
 * model-viewer generates a USDZ for on the fly) or Android Scene Viewer, placing
 * the painting on a wall at its real size. On desktop it's a rotatable 3D preview.
 */
export function ArViewer({ src, alt, promoted = false }: ArViewerProps) {
  // `promoted` is read from window.location.search in a parent effect, so it
  // can flip true a tick after this component's first render. Deriving `open`
  // from `promoted || manuallyOpened` (rather than syncing a separate `open`
  // state via an effect) means that later flip is picked up for free.
  const [manuallyOpened, setManuallyOpened] = useState(false)
  const open = promoted || manuallyOpened
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [arSupported, setArSupported] = useState<boolean | null>(null)
  const coarsePointer = useCoarsePointer()
  const modelRef = useRef<HTMLElement | null>(null)

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

  // Once the model has loaded, ask model-viewer whether this device can
  // actually launch AR (WebXR / Scene Viewer / Quick Look). The built-in
  // ar-button slot already hides itself when AR isn't available — this is
  // only used to swap the caption on an unsupported phone so nothing reads
  // as broken.
  useEffect(() => {
    const el = modelRef.current
    if (!el) return
    function handleLoad() {
      setArSupported(
        Boolean((el as unknown as { canActivateAR?: boolean }).canActivateAR)
      )
    }
    el.addEventListener("load", handleLoad)
    return () => el.removeEventListener("load", handleLoad)
  }, [ready])

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setManuallyOpened(true)}
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

  const unsupportedOnPhone = coarsePointer && arSupported === false

  const caption = unsupportedOnPhone
    ? "AR isn't supported on this phone — but here's the painting up close."
    : promoted
      ? "Tap, then point your camera at your wall — the painting appears at its real size."
      : (
          <>
            On a phone, tap <span className="font-medium">View in your space</span>{" "}
            and point your camera at a wall — the painting appears at its real size.
            On a computer, drag to rotate.
          </>
        )

  return (
    <div className="space-y-3">
      {createElement(
        "model-viewer",
        {
          ref: modelRef,
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
            className: promoted
              ? "ar-pulse absolute bottom-4 left-4 right-4 rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background shadow-lg"
              : "absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background shadow-lg",
          },
          "View in your space"
        )
      )}
      <p className="text-xs text-muted-foreground text-center">{caption}</p>
    </div>
  )
}
