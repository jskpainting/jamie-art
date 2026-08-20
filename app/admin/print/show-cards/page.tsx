import Link from "next/link"
import type { Metadata } from "next"
import { getPaintingsForCards, getArModelIds, type PaintingForCards } from "@/lib/db/queries"
import { generateQrSvg, cardTargetUrl } from "@/components/print/qr"
import { ShowCard } from "@/components/print/show-card"
import { PrintButton } from "@/components/print/print-button"
import { DismissibleNotice } from "@/components/print/dismissible-notice"

export const metadata: Metadata = {
  title: "Print show cards · Admin · Jamie Kendrioski",
}

const CARD_WIDTH_MM = 88.9
const CARD_HEIGHT_MM = 50.8
const CARDS_PER_SHEET = 10 // 2 cols x 5 rows
const TICK_LENGTH_MM = 4
const TICK_BORDER = "0.5pt solid #999"

interface PaperConfig {
  label: string
  pageWidthMm: number
  pageHeightMm: number
  marginLRMm: number
  marginTBMm: number
  atPageSize: string
}

const PAPERS: Record<"letter" | "a4", PaperConfig> = {
  letter: {
    label: "Letter",
    pageWidthMm: 215.9,
    pageHeightMm: 279.4,
    marginLRMm: 19.05,
    marginTBMm: 12.7,
    atPageSize: "letter",
  },
  a4: {
    label: "A4",
    pageWidthMm: 210,
    pageHeightMm: 297,
    marginLRMm: 16.1,
    marginTBMm: 21.5,
    atPageSize: "210mm 297mm",
  },
}

interface CardEntry {
  painting: PaintingForCards
  qrSvg: string
}

/** Parses `c=<id>:<copies>,<id>:<copies>,...` into { id, copies }[], clamping copies to 1..99. */
function parseCopiesParam(raw: string | undefined): { id: string; copies: number }[] {
  if (!raw) return []
  return raw
    .split(",")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const [id, copiesRaw] = chunk.split(":")
      const copies = Math.min(99, Math.max(1, parseInt(copiesRaw ?? "1", 10) || 1))
      return { id, copies }
    })
    .filter((row) => !!row.id)
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/** Cut-guide tick marks — 4mm segments drawn ONLY in the sheet margins, aligned to grid lines. Never between cards. */
function TickMarks({ paper, cols, rows }: { paper: PaperConfig; cols: number; rows: number }) {
  const gridLeft = paper.marginLRMm
  const gridTop = paper.marginTBMm
  const gridRight = gridLeft + cols * CARD_WIDTH_MM
  const gridBottom = gridTop + rows * CARD_HEIGHT_MM

  const verticalLines = Array.from({ length: cols + 1 }, (_, i) => gridLeft + i * CARD_WIDTH_MM)
  const horizontalLines = Array.from({ length: rows + 1 }, (_, i) => gridTop + i * CARD_HEIGHT_MM)

  return (
    <>
      {verticalLines.map((x, i) => (
        <span key={`vt-${i}`}>
          <span
            style={{
              position: "absolute",
              left: `${x}mm`,
              top: `${gridTop - TICK_LENGTH_MM}mm`,
              height: `${TICK_LENGTH_MM}mm`,
              borderLeft: TICK_BORDER,
            }}
          />
          <span
            style={{
              position: "absolute",
              left: `${x}mm`,
              top: `${gridBottom}mm`,
              height: `${TICK_LENGTH_MM}mm`,
              borderLeft: TICK_BORDER,
            }}
          />
        </span>
      ))}
      {horizontalLines.map((y, i) => (
        <span key={`hz-${i}`}>
          <span
            style={{
              position: "absolute",
              top: `${y}mm`,
              left: `${gridLeft - TICK_LENGTH_MM}mm`,
              width: `${TICK_LENGTH_MM}mm`,
              borderTop: TICK_BORDER,
            }}
          />
          <span
            style={{
              position: "absolute",
              top: `${y}mm`,
              left: `${gridRight}mm`,
              width: `${TICK_LENGTH_MM}mm`,
              borderTop: TICK_BORDER,
            }}
          />
        </span>
      ))}
    </>
  )
}

/** Page-1-only calibration bar: a 50.8mm (2in) rule in the bottom trim margin. */
function CalibrationRuler({ paper }: { paper: PaperConfig }) {
  return (
    <div
      style={{
        position: "absolute",
        left: `${paper.marginLRMm}mm`,
        top: `${paper.pageHeightMm - paper.marginTBMm / 2}mm`,
        transform: "translateY(-50%)",
      }}
    >
      <div style={{ width: "50.8mm", height: "0.5pt", background: "#999" }} />
      <p
        className="font-sans"
        style={{ marginTop: "1mm", fontSize: "6pt", color: "#6B6B66", whiteSpace: "nowrap" }}
      >
        this bar should measure exactly 2 inches — if not, set Scale to 100
      </p>
    </div>
  )
}

export default async function PrintShowCardsPage({
  searchParams,
}: {
  searchParams: Promise<{ paper?: string; thumb?: string; tagline?: string; c?: string }>
}) {
  const params = await searchParams
  const paper = params.paper === "a4" ? PAPERS.a4 : PAPERS.letter
  const showThumb = params.thumb !== "0"
  const tagline = (params.tagline ?? "Scan to see it on your wall").trim() || "Scan to see it on your wall"
  const requested = parseCopiesParam(params.c)

  if (requested.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-neutral-100 p-8 text-center">
        <p className="text-lg font-medium text-neutral-900">No paintings selected</p>
        <p className="max-w-sm text-sm text-neutral-600">
          Pick some paintings on the Show cards page first, then come back here to print.
        </p>
        <Link
          href="/admin/show-cards"
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
        >
          Back to Show cards
        </Link>
      </div>
    )
  }

  const [allPaintings, arModelIds] = await Promise.all([
    getPaintingsForCards(), // one query — see lib/db/queries.ts
    getArModelIds(),
  ])
  const byId = new Map(allPaintings.map((p) => [p.id, p]))

  const foundIds: string[] = []
  const missingIds: string[] = []
  for (const { id } of requested) {
    if (byId.has(id)) foundIds.push(id)
    else missingIds.push(id)
  }

  if (foundIds.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-neutral-100 p-8 text-center">
        <p className="text-lg font-medium text-neutral-900">
          None of the selected paintings could be found
        </p>
        <p className="max-w-sm text-sm text-neutral-600">
          They may have been deleted since you made your selection. Head back and pick again.
        </p>
        <Link
          href="/admin/show-cards"
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
        >
          Back to Show cards
        </Link>
      </div>
    )
  }

  // Generate each distinct painting's QR SVG once, then expand into copies.
  const qrByPaintingId = new Map<string, string>()
  await Promise.all(
    foundIds.map(async (id) => {
      const p = byId.get(id)!
      const url = cardTargetUrl(p.section_slug, p.slug, arModelIds.has(p.id))
      qrByPaintingId.set(id, await generateQrSvg(url))
    })
  )

  const allCards: CardEntry[] = []
  for (const { id, copies } of requested) {
    const painting = byId.get(id)
    if (!painting) continue
    const qrSvg = qrByPaintingId.get(id) ?? ""
    for (let i = 0; i < copies; i++) allCards.push({ painting, qrSvg })
  }

  const sheets = chunk(allCards, CARDS_PER_SHEET)

  return (
    <div className="min-h-screen bg-neutral-200">
      <style>{`
        @page { size: ${paper.atPageSize}; margin: 0; }
        @media print {
          html, body { background: #fff !important; }
        }
        .sheet {
          width: ${paper.pageWidthMm}mm;
          height: ${paper.pageHeightMm}mm;
          position: relative;
          background: #fff;
          page-break-after: always;
          print-color-adjust: exact;
          -webkit-print-color-adjust: exact;
        }
        .sheet:last-child { page-break-after: auto; }
        .card { position: absolute; width: ${CARD_WIDTH_MM}mm; height: ${CARD_HEIGHT_MM}mm; }
      `}</style>

      <div className="print:hidden sticky top-0 z-30 border-b border-neutral-300 bg-white px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-neutral-700">
            In the print window choose <strong>Save as PDF</strong>, Margins{" "}
            <strong>Default</strong>, Scale <strong>100</strong> (never &ldquo;Fit&rdquo;).
            Print on plain white {paper.label} paper.
          </p>
          <PrintButton />
        </div>
      </div>

      <div className="print:hidden mx-auto max-w-3xl px-4 pt-4">
        {missingIds.length > 0 && (
          <DismissibleNotice
            message={`${missingIds.length} painting${missingIds.length === 1 ? "" : "s"} couldn't be found and ${missingIds.length === 1 ? "was" : "were"} left out.`}
          />
        )}
      </div>

      <div className="flex flex-col items-center gap-8 py-8 print:gap-0 print:py-0">
        {sheets.map((sheetCards, sheetIndex) => (
          <div key={sheetIndex} className="sheet shadow-lg print:shadow-none">
            <TickMarks paper={paper} cols={2} rows={5} />
            {sheetIndex === 0 && <CalibrationRuler paper={paper} />}
            {sheetCards.map((entry, i) => {
              const col = i % 2
              const row = Math.floor(i / 2)
              const x = paper.marginLRMm + col * CARD_WIDTH_MM
              const y = paper.marginTBMm + row * CARD_HEIGHT_MM
              return (
                <div
                  key={`${entry.painting.id}-${i}`}
                  className="card"
                  style={{ left: `${x}mm`, top: `${y}mm` }}
                >
                  <ShowCard
                    painting={entry.painting}
                    qrSvg={entry.qrSvg}
                    showThumb={showThumb}
                    tagline={tagline}
                  />
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
