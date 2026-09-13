"use client"

import {
  createElement,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import { detectArSupport } from "@/lib/ar-support"

function subscribeNoop() {
  return () => {}
}
function getArSupportServerSnapshot() {
  return "none" as const
}

interface ArViewerProps {
  /** Public URL of the painting's .glb model. */
  src: string
  alt: string
  /**
   * True for the `?ar=1` QR-card arrival flow. Starts loading
   * `@google/model-viewer` immediately and attempts to open AR without
   * waiting for a tap.
   */
  promoted?: boolean
}

type ViewerState = "idle" | "loading" | "ready" | "pulsing" | "unsupported" | "failed"

/**
 * "View on my wall" — a single button that launches the device's native AR
 * (iOS AR Quick Look or Android Scene Viewer) to place the painting on a
 * wall at its real size. Renders nothing during SSR and nothing at all on a
 * device that can't do AR (desktops included) — there is no 3D-preview
 * fallback. `@google/model-viewer` (~1MB) is only fetched once the visitor
 * taps the button (or immediately for the promoted `?ar=1` QR flow).
 */
export function ArViewer({ src, alt, promoted = false }: ArViewerProps) {
  // detectArSupport() is deterministic for a given client (it doesn't change
  // across the page's lifetime), so a noop subscription is fine here — this
  // is just how we get "none" on the server/first paint and the real value
  // once mounted, without a setState-in-effect render cascade.
  const support = useSyncExternalStore(
    subscribeNoop,
    detectArSupport,
    getArSupportServerSnapshot
  )
  const [state, setState] = useState<ViewerState>("idle")
  const [libLoaded, setLibLoaded] = useState(false)
  const modelRef = useRef<HTMLElement | null>(null)
  const autoStartedRef = useRef(false)

  async function ensureLibLoaded() {
    if (libLoaded) return
    await import("@google/model-viewer")
    setLibLoaded(true)
  }

  async function handleActivate() {
    if (state === "loading") return
    if (state === "ready" || state === "pulsing") {
      try {
        await (
          modelRef.current as unknown as
            | { activateAR?: () => Promise<void> | void }
            | null
        )?.activateAR?.()
      } catch {
        // Already loaded; a failed re-tap just leaves the button as-is.
      }
      return
    }
    setState("loading")
    try {
      await ensureLibLoaded()
    } catch {
      setState("failed")
    }
  }

  // Promoted (`?ar=1`) flow: start loading as soon as we know AR is
  // supported, without waiting for a tap.
  useEffect(() => {
    if (!promoted || support === "none") return
    if (autoStartedRef.current) return
    autoStartedRef.current = true
    setState("loading")
    ensureLibLoaded().catch(() => setState("failed"))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promoted, support])

  // Once the (hidden) model-viewer element is mounted, wait for it to load
  // the model, then try to launch AR.
  useEffect(() => {
    if (!libLoaded) return
    const el = modelRef.current
    if (!el) return
    let cancelled = false

    function handleLoad() {
      if (cancelled || !el) return
      const canActivateAR = Boolean(
        (el as unknown as { canActivateAR?: boolean }).canActivateAR
      )
      if (!canActivateAR) {
        setState("unsupported")
        return
      }
      try {
        const result = (
          el as unknown as { activateAR: () => Promise<void> | void }
        ).activateAR()
        // Optimistically show the ready/pulsing button as soon as AR is
        // requested — activateAR() only resolves once the AR session ends
        // (iOS Quick Look, in particular), so awaiting it would leave the
        // button stuck in a loading state for the whole visit.
        setState(promoted ? "pulsing" : "ready")
        if (result && typeof (result as Promise<void>).catch === "function") {
          ;(result as Promise<void>).catch(() => {
            if (cancelled) return
            setState(promoted ? "pulsing" : "failed")
          })
        }
      } catch {
        if (cancelled) return
        setState(promoted ? "pulsing" : "failed")
      }
    }

    el.addEventListener("load", handleLoad)
    return () => {
      cancelled = true
      el.removeEventListener("load", handleLoad)
    }
  }, [libLoaded, promoted])

  if (support === "none") return null

  const arIcon = (
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
  )

  // Kept mounted (never unmounted once loaded) so a second tap is instant —
  // rendered visually hidden rather than `display:none`, which model-viewer
  // needs to lay itself out and load the model. Written as an unconditional
  // literal within each guarded branch below (not `libLoaded && createElement(...)`)
  // so passing `modelRef` here reads as ordinary element-ref wiring rather
  // than a render-time ref read.
  if (!libLoaded) {
    const isLoading = state === "loading"
    return (
      <div className="flex flex-col gap-3 border-t border-border pt-5">
        <span className="text-xs uppercase tracking-[0.2em] font-medium text-muted-foreground">
          See it in your space
        </span>
        <button
          type="button"
          onClick={handleActivate}
          disabled={isLoading}
          className="inline-flex w-fit items-center justify-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-60"
        >
          {arIcon}
          {isLoading ? "Opening your camera…" : "View on my wall"}
        </button>
      </div>
    )
  }

  if (state === "loading") {
    return (
      <div className="flex flex-col gap-3 border-t border-border pt-5">
        <span className="text-xs uppercase tracking-[0.2em] font-medium text-muted-foreground">
          See it in your space
        </span>
        <button
          type="button"
          disabled
          className="inline-flex w-fit items-center justify-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium disabled:opacity-60"
        >
          {arIcon}
          Opening your camera…
        </button>
        {createElement("model-viewer", {
          ref: modelRef,
          src,
          alt,
          ar: true,
          "ar-modes": "webxr scene-viewer quick-look",
          "ar-placement": "wall",
          style: {
            position: "absolute",
            width: "1px",
            height: "1px",
            opacity: 0,
            pointerEvents: "none",
          },
        })}
      </div>
    )
  }

  if (state === "unsupported" || state === "failed") {
    return (
      <div className="flex flex-col gap-3 border-t border-border pt-5">
        <span className="text-xs uppercase tracking-[0.2em] font-medium text-muted-foreground">
          See it in your space
        </span>
        <p className="text-sm text-muted-foreground">
          {state === "unsupported"
            ? "AR isn't available on this device."
            : "Couldn’t open AR — please try again."}
        </p>
        {createElement("model-viewer", {
          ref: modelRef,
          src,
          alt,
          ar: true,
          "ar-modes": "webxr scene-viewer quick-look",
          "ar-placement": "wall",
          style: {
            position: "absolute",
            width: "1px",
            height: "1px",
            opacity: 0,
            pointerEvents: "none",
          },
        })}
      </div>
    )
  }

  const isPulsing = state === "pulsing"

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-5">
      <span className="text-xs uppercase tracking-[0.2em] font-medium text-muted-foreground">
        See it in your space
      </span>
      <button
        type="button"
        onClick={handleActivate}
        className={
          isPulsing
            ? "ar-pulse inline-flex w-fit items-center justify-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background shadow-lg"
            : "inline-flex w-fit items-center justify-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium hover:bg-muted transition-colors"
        }
      >
        {arIcon}
        View on my wall
      </button>
      {isPulsing && (
        <p className="text-xs text-muted-foreground">
          Tap to see it on your wall
        </p>
      )}
      {createElement("model-viewer", {
        ref: modelRef,
        src,
        alt,
        ar: true,
        "ar-modes": "webxr scene-viewer quick-look",
        "ar-placement": "wall",
        style: {
          position: "absolute",
          width: "1px",
          height: "1px",
          opacity: 0,
          pointerEvents: "none",
        },
      })}
    </div>
  )
}
