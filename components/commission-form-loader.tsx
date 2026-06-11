"use client"

// ssr: false must be declared in a Client Component.
// This wrapper keeps commission/page.tsx as a Server Component.
import dynamic from "next/dynamic"

const CommissionFormDynamic = dynamic(
  () => import("@/components/commission-form").then((m) => m.CommissionForm),
  { ssr: false, loading: () => <div className="h-64 bg-muted animate-pulse rounded-lg" /> }
)

interface Props {
  initialPainting?: string
  initialPaintingId?: string
}

export function CommissionFormLoader({ initialPainting, initialPaintingId }: Props) {
  return (
    <CommissionFormDynamic
      initialPainting={initialPainting}
      initialPaintingId={initialPaintingId}
    />
  )
}
