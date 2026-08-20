// Single source of truth for the "show card" business-card layout — used by
// both the live admin proof (/admin/show-cards) and the print sheet
// (/admin/print/show-cards). Renders at the card's true physical size via mm
// CSS units, per docs/BUILD_SPEC.md's show-cards design plan.
//
// Colors are hardcoded hex (not the site's --background/--foreground tokens)
// on purpose: this must always print pure white / near-black regardless of
// the viewer's light/dark theme.

export const CARD_WIDTH_MM = 88.9
export const CARD_HEIGHT_MM = 50.8
const SAFE_INSET_MM = 4.5
const THUMB_SIZE_MM = 20
const QR_SIZE_MM = 22

export interface ShowCardPainting {
  id: string
  title: string
  slug: string
  section_slug: string
  primary_image_url: string | null
  medium: string | null
  dimensions: string | null
  year: number | null
}

/**
 * Route the thumbnail through Next's built-in image optimizer at a fixed
 * width so it's requested at >=480px even though it prints at 20mm — never a
 * raw multi-megapixel original, never a tiny cached thumb.
 */
function thumbSrc(url: string): string {
  return `/_next/image?url=${encodeURIComponent(url)}&w=640&q=90`
}

function metadataLine(p: ShowCardPainting): string {
  return [p.medium, p.dimensions, p.year ? String(p.year) : null]
    .filter((v): v is string => !!v && v.trim().length > 0)
    .join(" · ")
}

export interface ShowCardProps {
  painting: ShowCardPainting
  /** Raw QR SVG markup, generated server-side (never a PNG data URL — see BUILD_SPEC). */
  qrSvg: string
  /** Whether to show the thumbnail. Forced off automatically when there's no image. */
  showThumb: boolean
  tagline: string
}

export function ShowCard({ painting, qrSvg, showThumb, tagline }: ShowCardProps) {
  const hasImage = !!painting.primary_image_url
  const effectiveShowThumb = showThumb && hasImage
  const meta = metadataLine(painting)
  const taglineLines = tagline.split("\n").filter(Boolean)
  if (taglineLines.length === 0) taglineLines.push(tagline)

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
      <div
        className="card-inner"
        style={{ position: "absolute", inset: `${SAFE_INSET_MM}mm` }}
      >
        {effectiveShowThumb && painting.primary_image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbSrc(painting.primary_image_url)}
            alt=""
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: `${THUMB_SIZE_MM}mm`,
              height: `${THUMB_SIZE_MM}mm`,
              objectFit: "cover",
              display: "block",
            }}
          />
        )}

        <div
          className="qr [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: `${QR_SIZE_MM}mm`,
            height: `${QR_SIZE_MM}mm`,
          }}
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />

        <div
          className="font-serif"
          style={{
            position: "absolute",
            left: effectiveShowThumb ? "24mm" : "0mm",
            top: "1mm",
            width: effectiveShowThumb ? "30.9mm" : "55mm",
          }}
        >
          <div
            style={{
              fontWeight: 500,
              fontSize: effectiveShowThumb ? "11pt" : "13pt",
              lineHeight: "12.5pt",
              color: "#0A0A0A",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {painting.title}
          </div>
          {meta && (
            <div
              className="font-sans"
              style={{
                marginTop: "1mm",
                fontSize: "6.5pt",
                color: "#6B6B66",
                lineHeight: 1.3,
              }}
            >
              {meta}
            </div>
          )}
        </div>

        <div
          className="font-sans"
          style={{
            position: "absolute",
            right: 0,
            top: `${QR_SIZE_MM + 1}mm`,
            width: `${QR_SIZE_MM}mm`,
            textAlign: "center",
            fontSize: "6pt",
            color: "#6B6B66",
            lineHeight: 1.35,
          }}
        >
          {taglineLines.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>

        <div
          className="font-sans"
          style={{ position: "absolute", left: 0, bottom: 0 }}
        >
          <div
            style={{
              fontSize: "6.5pt",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: ".18em",
              color: "#0A0A0A",
            }}
          >
            JAMIE KENDRIOSKI
          </div>
          <div style={{ fontSize: "5.5pt", color: "#6B6B66", marginTop: "0.5mm" }}>
            jamiekendrioski.com
          </div>
        </div>
      </div>
    </div>
  )
}
