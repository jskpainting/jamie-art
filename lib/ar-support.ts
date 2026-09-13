/**
 * Client-safe AR capability detection.
 *
 * "quick-look" — iOS/iPadOS, any browser. AR Quick Look is a system-level
 * anchor mechanism (the same one `<model-viewer>` uses), so it works in
 * Safari, Chrome-on-iOS, etc. iPadOS reports itself as "MacIntel" — we
 * distinguish a real Mac from an iPad via touch support
 * (`navigator.maxTouchPoints > 1`).
 *
 * "scene-viewer" — Android with a Chromium-based browser (Scene Viewer is a
 * Google Play Services feature invoked via Chrome's intent mechanism).
 *
 * "none" — everything else, including SSR (no `window`).
 */
export function detectArSupport(): "quick-look" | "scene-viewer" | "none" {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return "none"
  }

  const ua = navigator.userAgent || ""
  const platform = navigator.platform || ""

  const isIOS = /iPad|iPhone|iPod/.test(ua)
  const isIPadOnMac = platform === "MacIntel" && navigator.maxTouchPoints > 1
  if (isIOS || isIPadOnMac) {
    return "quick-look"
  }

  const isAndroid = /Android/.test(ua)
  const isChromium = /Chrome|Chromium|CriOS/.test(ua)
  if (isAndroid && isChromium) {
    return "scene-viewer"
  }

  return "none"
}
