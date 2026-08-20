// Server-only QR generation for show cards. Always SVG (never a PNG data URL
// — raster QR codes go soft/pixelated at print DPI; SVG stays crisp cut to
// exact mm size). See docs/BUILD_SPEC.md's show-cards design plan.

import QRCode from "qrcode"
import { SITE_URL } from "@/lib/site"

/**
 * The URL encoded into a painting's show-card QR: the painting's canonical
 * page, with `?ar=1` appended only when an AR model exists for it.
 */
export function cardTargetUrl(
  sectionSlug: string,
  slug: string,
  hasArModel: boolean
): string {
  const path = `/portfolio/${sectionSlug}/${slug}`
  return hasArModel ? `${SITE_URL}${path}?ar=1` : `${SITE_URL}${path}`
}

export async function generateQrSvg(targetUrl: string): Promise<string> {
  return QRCode.toString(targetUrl, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 4,
  })
}
