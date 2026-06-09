import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { PageHeader } from "@/components/admin/page-header"
import { getSections } from "@/lib/db/queries"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SectionEditButton } from "./section-edit-button"

export const metadata: Metadata = {
  title: "Portfolio · Admin · Jamie Kendrioski",
}

export default async function PortfolioAdminPage() {
  const sections = await getSections()

  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="Portfolio"
        description="Manage paintings across all sections."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {sections.map((section) => (
          <div
            key={section.id}
            className="rounded-xl border border-border bg-card overflow-hidden"
          >
            {/* Cover image */}
            <div className="relative h-36 bg-gradient-to-br from-muted to-muted/30">
              {section.cover_image_url && (
                <Image
                  src={section.cover_image_url}
                  alt={section.title}
                  fill
                  className="object-cover"
                />
              )}
            </div>

            <div className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-medium text-sm">{section.title}</h2>
                  {section.description && (
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                      {section.description}
                    </p>
                  )}
                </div>
                <Badge variant="secondary" className="shrink-0 text-xs">
                  {section.painting_count}{" "}
                  {section.painting_count === 1 ? "painting" : "paintings"}
                </Badge>
              </div>

              <div className="flex gap-2">
                <SectionEditButton section={section} />
                <Button
                  variant="outline"
                  size="sm"
                  render={<Link href={`/admin/portfolio/${section.slug}`} />}
                >
                  Manage →
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
