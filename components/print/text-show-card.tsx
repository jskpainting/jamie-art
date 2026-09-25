"use client"

// The "Text only" show card: no picture, no QR code, no email — just the
// artist's name, the painting's title and year, its medium and size, and the
// price, set large enough to read from about three feet away. Same 3.5 x 2 in
// size as ShowCard, so it prints on the same sheet.
//
// Order top to bottom: name, title (year), medium · size, price.
// Emphasis: name and title most prominent (told apart by typeface — bold
// spaced capitals vs the large serif — and a fine rule, never a background
// strip), then the price, then the details.
//
// Long titles shrink to fit instead of being cut off: once fonts have loaded,
// every sized element in the text box is scaled down together, 3% at a time,
// until nothing sits outside the box — never below each element's minimum.

import { useLayoutEffect, useRef } from "react"
import { normalizeDimensions } from "@/lib/painting-caption"
import { CARD_WIDTH_MM, CARD_HEIGHT_MM, type ShowCardPainting } from "./show-card"

const TEXT_COLOR = "#0A0A0A"
const MUTED_COLOR = "#5C5B56"
const HAIRLINE_COLOR = "#D9D6CC"

/** Font sizes in pt: [starting size, smallest it may shrink to]. */
const SIZES = {
  name: [14, 9],
  title: [22, 12],
  details: [12.5, 9],
  price: [18, 12],
} as const

function fitProps([base, min]: readonly [number, number]) {
  return {
    "data-fit-base": base,
    "data-fit-min": min,
  }
}

function overflows(box: HTMLElement): boolean {
  const b = box.getBoundingClientRect()
  for (const el of box.querySelectorAll<HTMLElement>("*")) {
    const r = el.getBoundingClientRect()
    if (!r.width && !r.height) continue
    if (
      r.bottom > b.bottom + 0.5 ||
      r.right > b.right + 0.5 ||
      r.left < b.left - 0.5 ||
      r.top < b.top - 0.5
    ) {
      return true
    }
    // A single word too long for its line spills sideways without moving the
    // element's own box, so check that separately.
    if (getComputedStyle(el).display !== "inline" && el.scrollWidth > el.clientWidth + 1) {
      return true
    }
  }
  return false
}

function fitToBox(box: HTMLElement) {
  const els = [...box.querySelectorAll<HTMLElement>("[data-fit-min]")]
  for (const el of els) el.style.fontSize = `${el.dataset.fitBase}pt`
  for (let i = 0; i < 60 && overflows(box); i++) {
    let shrank = false
    for (const el of els) {
      const current = parseFloat(el.style.fontSize)
      const min = Number(el.dataset.fitMin)
      if (current > min) {
        el.style.fontSize = `${Math.max(min, current * 0.97).toFixed(2)}pt`
        shrank = true
      }
    }
    if (!shrank) break
  }
}

/** "$2,500" + "+tax", or the status word when it isn't for sale. */
function priceParts(p: ShowCardPainting): { main: string; tax: boolean } | null {
  if (p.status === "sold") return { main: "SOLD", tax: false }
  if (p.status === "nfs") return { main: "Not for sale", tax: false }
  if (p.status === "reserved") return { main: "Reserved", tax: false }
  if (p.price_cents && p.price_cents > 0) {
    const dollars = p.price_cents / 100
    const shown = Number.isInteger(dollars)
      ? dollars.toLocaleString("en-US")
      : dollars.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    return { main: `$${shown}`, tax: true }
  }
  return null
}

export function TextShowCard({ painting }: { painting: ShowCardPainting }) {
  const boxRef = useRef<HTMLDivElement>(null)

  const details = [(painting.medium ?? "").trim(), normalizeDimensions(painting.dimensions)]
    .filter(Boolean)
    .join(" · ")
  const price = priceParts(painting)

  useLayoutEffect(() => {
    const box = boxRef.current
    if (!box) return
    fitToBox(box)
    // Measurements taken before the web fonts arrive are wrong; fit again.
    let cancelled = false
    document.fonts?.ready.then(() => {
      if (!cancelled && boxRef.current) fitToBox(boxRef.current)
    })
    return () => {
      cancelled = true
    }
  }, [painting.title, painting.year, details, price?.main, price?.tax])

  return (
    <div
      className="show-card"
      style={{
        position: "relative",
        width: `${CARD_WIDTH_MM}mm`,
        height: `${CARD_HEIGHT_MM}mm`,
        background: "#fff",
        color: TEXT_COLOR,
        overflow: "hidden",
      }}
    >
      <div
        ref={boxRef}
        style={{
          position: "absolute",
          inset: "5mm",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          className="font-sans"
          {...fitProps(SIZES.name)}
          style={{
            fontSize: `${SIZES.name[0]}pt`,
            fontWeight: 700,
            letterSpacing: ".07em",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            lineHeight: 1,
          }}
        >
          Jamie Kendrioski
        </div>

        <div style={{ margin: "2mm 0 2.2mm", borderTop: `0.5pt solid ${HAIRLINE_COLOR}` }} />

        <div
          className="font-serif"
          {...fitProps(SIZES.title)}
          style={{ fontSize: `${SIZES.title[0]}pt`, fontWeight: 500, lineHeight: 1.08 }}
        >
          {painting.title}
          {painting.year ? (
            <>
              {" "}
              <span
                className="font-sans"
                style={{
                  fontSize: ".56em",
                  fontWeight: 400,
                  color: MUTED_COLOR,
                  whiteSpace: "nowrap",
                }}
              >
                ({painting.year})
              </span>
            </>
          ) : null}
        </div>

        {details && (
          <div
            className="font-sans"
            {...fitProps(SIZES.details)}
            style={{
              fontSize: `${SIZES.details[0]}pt`,
              color: MUTED_COLOR,
              lineHeight: 1.35,
              marginTop: "1.6mm",
            }}
          >
            {details}
          </div>
        )}

        {price && (
          <div
            className="font-sans"
            {...fitProps(SIZES.price)}
            style={{
              fontSize: `${SIZES.price[0]}pt`,
              fontWeight: 700,
              lineHeight: 1.15,
              letterSpacing: "-.01em",
              whiteSpace: "nowrap",
              marginTop: "auto",
            }}
          >
            {price.main}
            {price.tax && (
              <span
                style={{
                  fontSize: ".42em",
                  fontWeight: 400,
                  color: MUTED_COLOR,
                  marginLeft: ".35em",
                  letterSpacing: 0,
                }}
              >
                +tax
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
