import type { Metadata } from "next"
import Link from "next/link"
import { PageHeader } from "@/components/admin/page-header"
import { getSettings } from "@/lib/db/queries"
import { getSchemaCapabilities, SCHEMA_SETUP_MESSAGE } from "@/lib/schema-capabilities"
import { SITE_COPY_DEFAULTS } from "@/lib/site-copy"
import { SiteCopyFieldForm } from "../settings/site-copy-form"
import { SettingsImageField } from "../settings/settings-image-field"

export const metadata: Metadata = {
  title: "Commission page — Admin",
  robots: { index: false },
}

export default async function AdminCommissionPage() {
  const [settings, capabilities] = await Promise.all([getSettings(), getSchemaCapabilities()])

  return (
    <div className="max-w-3xl">
      <div className="flex items-start justify-between gap-4 mb-8">
        <PageHeader
          eyebrow="Pages"
          title="Commission page"
          description="Everything visitors see on your Commissions page."
        />
        <Link
          href="/commission"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap mt-1"
        >
          View page ↗
        </Link>
      </div>

      <div className="flex flex-col gap-10">
        <SettingsImageField
          label="Photo at the top of the page"
          preset="commissionHero"
          currentImageUrl={settings?.commission_image_url ?? null}
          field="commission_image_url"
          hintText="Upload the full photo — then click the focal point below to control what stays visible."
          focalX={settings?.commission_focal_x ?? 50}
          focalY={settings?.commission_focal_y ?? 50}
          showFocal={capabilities.focalPoints}
        />

        <SiteCopyFieldForm
          field="commission_eyebrow"
          label="Small label above the heading"
          helper="The small capitalized text at the top, e.g. “Commissions”"
          initialValue={settings?.commission_eyebrow ?? SITE_COPY_DEFAULTS.commission_eyebrow}
          defaultText={SITE_COPY_DEFAULTS.commission_eyebrow}
        />

        <SiteCopyFieldForm
          field="commission_heading"
          label="Heading"
          helper="The large title on the page"
          initialValue={settings?.commission_heading ?? SITE_COPY_DEFAULTS.commission_heading}
          defaultText={SITE_COPY_DEFAULTS.commission_heading}
        />

        {capabilities.siteCopy ? (
          <SiteCopyFieldForm
            field="commission_intro"
            label="Opening paragraph"
            helper="The text under the heading, above the form"
            initialValue={settings?.commission_intro ?? SITE_COPY_DEFAULTS.commission_intro}
            defaultText={SITE_COPY_DEFAULTS.commission_intro}
            multiline
          />
        ) : (
          <p className="text-xs text-muted-foreground">{SCHEMA_SETUP_MESSAGE}</p>
        )}

        <p className="text-xs text-muted-foreground">
          The commission enquiry form below the text is always shown and isn&apos;t
          editable here.
        </p>
      </div>
    </div>
  )
}
