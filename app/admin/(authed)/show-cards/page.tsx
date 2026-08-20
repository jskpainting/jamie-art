import type { Metadata } from "next"
import { PageHeader } from "@/components/admin/page-header"
import { getPaintingsForCards, getArModelIds } from "@/lib/db/queries"
import { generateQrSvg, cardTargetUrl } from "@/components/print/qr"
import { ShowCardsClient } from "./show-cards-client"

export const metadata: Metadata = {
  title: "Show cards · Admin · Jamie Kendrioski",
}

export default async function ShowCardsAdminPage() {
  const [paintings, arModelIds] = await Promise.all([
    getPaintingsForCards(),
    getArModelIds(),
  ])

  // QR SVGs for every candidate painting, generated once up front so the
  // proof card can update live client-side without a server round-trip per
  // selection change. Cheap: pure string generation, no I/O.
  const qrByPaintingId: Record<string, string> = {}
  await Promise.all(
    paintings.map(async (p) => {
      const url = cardTargetUrl(p.section_slug, p.slug, arModelIds.has(p.id))
      qrByPaintingId[p.id] = await generateQrSvg(url)
    })
  )

  return (
    <div>
      <PageHeader
        eyebrow="Print"
        title="Show cards"
        description="Pick the paintings in your show, then print pocket cards with a code visitors can scan to see each painting on their own wall."
      />
      <ShowCardsClient
        paintings={paintings}
        arModelIds={[...arModelIds]}
        qrByPaintingId={qrByPaintingId}
      />
    </div>
  )
}
