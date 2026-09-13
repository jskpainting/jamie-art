// Single source of truth for the "show card" business-card layout — used by
// both the live admin proof (/admin/show-cards) and the print sheet
// (/admin/print/show-cards). Renders at the card's true physical size via mm
// CSS units, per docs/BUILD_SPEC.md's show-cards design plan.
//
// Colors are hardcoded hex (not the site's --background/--foreground tokens)
// on purpose: this must always print pure white / near-black regardless of
// the viewer's light/dark theme.
//
// Two layouts, picked automatically by painting shape (see layoutFor below):
//  - "side"  — image on the left (40 x 44.8mm), text column on the right.
//    Used for square/tall paintings, where a tall image box reads well.
//  - "stack" — image on top (full width, 25.5mm tall), a text band below.
//    Used for wide paintings, where a side-by-side image box would be tiny.

import { physicalOf } from "@/lib/mosaic-layout"

export const CARD_WIDTH_MM = 88.9
export const CARD_HEIGHT_MM = 50.8

const TEXT_COLOR = "#0A0A0A"
const MUTED_COLOR = "#6B6B66"
const EMAIL_COLOR = "#3D3D3A"
const HAIRLINE_COLOR = "#D9D6CC"

export interface ShowCardPainting {
  id: string
  title: string
  slug: string
  section_slug: string
  primary_image_url: string | null
  medium: string | null
  dimensions: string | null
  year: number | null
  width: number | null
  height: number | null
}

/**
 * Route the image through Next's built-in image optimizer at a fixed width
 * so it's requested at a resolution that holds up as the card's hero image
 * (it prints roughly 40mm wide, ~1080px at typical print DPI) — never a raw
 * multi-megapixel original, never a tiny cached thumb.
 */
function thumbSrc(url: string): string {
  return `/_next/image?url=${encodeURIComponent(url)}&w=1080&q=90`
}

function metadataLine(p: ShowCardPainting): string {
  return [p.medium, p.dimensions, p.year ? String(p.year) : null]
    .filter((v): v is string => !!v && v.trim().length > 0)
    .join(" · ")
}

export type CardLayout = "side" | "stack"

/**
 * Which layout reads best for a painting's shape: "stack" (image on top,
 * text band below) for wide paintings, "side" (image left, text right)
 * otherwise. Physical dimensions (from the `dimensions` text, e.g. `40"x16"`)
 * win when present since that's the true canvas shape; pixel dimensions of
 * the photographed image are the fallback.
 */
export function layoutFor(p: {
  dimensions: string | null
  width: number | null
  height: number | null
}): CardLayout {
  // The photo decides orientation; the entered size only breaks a tie.
  const physical = physicalOf(p)
  const ratio =
    p.width && p.height
      ? p.width / p.height
      : physical
        ? physical[0] / physical[1]
        : null
  return ratio != null && ratio > 1.15 ? "stack" : "side"
}

export interface ShowCardProps {
  painting: ShowCardPainting
  /** Raw QR SVG markup, generated server-side (never a PNG data URL — see BUILD_SPEC). */
  qrSvg: string
  tagline: string
  email: string | null
  /** Defaults to layoutFor(painting). */
  layout?: CardLayout
}

function Qr({
  qrSvg,
  sizeMm,
  alignSelf,
}: {
  qrSvg: string
  sizeMm: number
  alignSelf?: "flex-end"
}) {
  return (
    <div
      className="[&>svg]:block [&>svg]:h-full [&>svg]:w-full"
      style={{ width: `${sizeMm}mm`, height: `${sizeMm}mm`, flexShrink: 0, alignSelf }}
      dangerouslySetInnerHTML={{ __html: qrSvg }}
    />
  )
}

function Title({ title, fontSize }: { title: string; fontSize: string }) {
  return (
    <div
      className="font-serif"
      style={{
        fontWeight: 500,
        fontSize,
        lineHeight: 1.1,
        color: TEXT_COLOR,
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
      }}
    >
      {title}
    </div>
  )
}

function Meta({ meta, marginTopMm }: { meta: string; marginTopMm: number }) {
  if (!meta) return null
  return (
    <div
      className="font-sans"
      style={{
        fontSize: "6.5pt",
        color: MUTED_COLOR,
        marginTop: `${marginTopMm}mm`,
        lineHeight: 1.3,
      }}
    >
      {meta}
    </div>
  )
}

function Name() {
  return (
    <div
      className="font-sans"
      style={{
        fontSize: "6.5pt",
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: ".12em",
        whiteSpace: "nowrap",
        color: TEXT_COLOR,
      }}
    >
      JAMIE KENDRIOSKI
    </div>
  )
}

function Email({ email, marginTopMm }: { email: string | null; marginTopMm: number }) {
  if (!email) return null
  return (
    <div
      className="font-sans"
      style={{ fontSize: "6pt", color: EMAIL_COLOR, marginTop: `${marginTopMm}mm` }}
    >
      {email}
    </div>
  )
}

export function ShowCard({ painting, qrSvg, tagline, email, layout }: ShowCardProps) {
  const hasImage = !!painting.primary_image_url
  const meta = metadataLine(painting)
  const effectiveLayout = layout ?? layoutFor(painting)
  const resolvedLayout = hasImage ? effectiveLayout : "side"

  return (
    <div
      className="show-card"
      style={{
        position: "relative",
        width: `${CARD_WIDTH_MM}mm`,
        height: `${CARD_HEIGHT_MM}mm`,
        background: "#fff",
        overflow: "hidden",
      }}
    >
      {resolvedLayout === "side" ? (
        <>
          {hasImage && painting.primary_image_url && (
            <div
              style={{
                position: "absolute",
                left: "3mm",
                top: "3mm",
                width: "40mm",
                height: "44.8mm",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={thumbSrc(painting.primary_image_url)}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
              />
            </div>
          )}

          <div
            style={{
              position: "absolute",
              left: hasImage ? "47mm" : "4.5mm",
              top: "4.5mm",
              bottom: "4.5mm",
              right: "4.5mm",
              display: "flex",
              flexDirection: "column",
              gap: "2.5mm",
            }}
          >
            <div>
              <Title title={painting.title} fontSize="12pt" />
              <Meta meta={meta} marginTopMm={1} />
            </div>

            <div
              style={{
                borderTop: `0.4pt solid ${HAIRLINE_COLOR}`,
                paddingTop: "1.6mm",
              }}
            >
              <Name />
              <Email email={email} marginTopMm={0.6} />
            </div>

            <div
              style={{
                marginTop: "auto",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-end",
              }}
            >
              {tagline ? (
                <div
                  className="font-sans"
                  style={{
                    fontSize: "5.5pt",
                    color: MUTED_COLOR,
                    width: "19mm",
                    lineHeight: 1.35,
                  }}
                >
                  {tagline}
                </div>
              ) : (
                <div />
              )}
              <Qr qrSvg={qrSvg} sizeMm={15} />
            </div>
          </div>
        </>
      ) : (
        <>
          {hasImage && painting.primary_image_url && (
            <div
              style={{
                position: "absolute",
                left: "3mm",
                right: "3mm",
                top: "3mm",
                height: "25.5mm",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={thumbSrc(painting.primary_image_url)}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
              />
            </div>
          )}

          <div
            style={{
              position: "absolute",
              left: "4.5mm",
              right: "4.5mm",
              top: "31mm",
              bottom: "4.5mm",
              display: "flex",
              flexDirection: "row",
              gap: "2mm",
              justifyContent: "space-between",
            }}
          >
            <div style={{ width: "31mm" }}>
              <Title title={painting.title} fontSize="11pt" />
              <Meta meta={meta} marginTopMm={1} />
            </div>

            <div
              style={{
                width: "31mm",
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
              }}
            >
              <Name />
              <Email email={email} marginTopMm={0.6} />
              {tagline && (
                <div
                  className="font-sans"
                  style={{
                    fontSize: "5.5pt",
                    color: MUTED_COLOR,
                    marginTop: "1.2mm",
                    lineHeight: 1.35,
                  }}
                >
                  {tagline}
                </div>
              )}
            </div>

            <Qr qrSvg={qrSvg} sizeMm={14} alignSelf="flex-end" />
          </div>
        </>
      )}
    </div>
  )
}
