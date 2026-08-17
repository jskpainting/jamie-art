import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { getSettings, getAllPaintingsForPicker, getBio } from "@/lib/db/queries"
import { getSchemaCapabilities, SCHEMA_SETUP_MESSAGE } from "@/lib/schema-capabilities"
import { SITE_COPY_DEFAULTS } from "@/lib/site-copy"
import { SettingsForm } from "./settings-form"
import { SiteCopyFieldForm } from "./site-copy-form"
import { FeaturedPaintingPickerForm } from "./featured-painting-picker-form"
import { SettingsImageField } from "./settings-image-field"
import { PageCard } from "./page-card"

export const metadata: Metadata = {
  title: "Settings — Admin",
  robots: { index: false },
}

export default async function SettingsPage() {
  const [settings, paintings, capabilities, bio] = await Promise.all([
    getSettings(),
    getAllPaintingsForPicker(),
    getSchemaCapabilities(),
    getBio(),
  ])

  const aboutImageUrl = bio?.headshot_url ?? settings?.about_image_url ?? null

  return (
    <div className="max-w-3xl">
      <p className="text-xs uppercase tracking-[0.2em] font-medium text-muted-foreground mb-2">
        Settings
      </p>
      <h1 className="text-2xl md:text-3xl font-light font-serif tracking-tight mb-1">
        Edit your site
      </h1>
      <p className="text-sm text-muted-foreground mb-8">
        Everything here changes what visitors see, organized by page.
      </p>

      <div className="flex flex-col gap-8">
        {/* Home page */}
        <PageCard title="Home page" href="/">
          {capabilities.siteCopy ? (
            <SiteCopyFieldForm
              field="tagline"
              label="Tagline — shown under your name"
              helper="Appears on the home page and in the menu"
              initialValue={settings?.tagline ?? SITE_COPY_DEFAULTS.tagline_nav}
              defaultText={SITE_COPY_DEFAULTS.tagline_nav}
            />
          ) : (
            <p className="text-xs text-muted-foreground">{SCHEMA_SETUP_MESSAGE}</p>
          )}

          <div>
            <p className="text-sm font-medium mb-1">
              Painting shown on the home page
            </p>
            <FeaturedPaintingPickerForm
              paintings={paintings}
              initialId={settings?.featured_painting_id ?? null}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              If a custom photo is uploaded below, it takes priority. Otherwise this
              painting will be featured on the home page. If neither is set, the
              latest available abstract is used.
            </p>
          </div>

          <SettingsImageField
            label="Or upload a custom hero photo"
            aspectRatio={3 / 4}
            currentImageUrl={settings?.home_hero_image_url ?? null}
            bucket="site-images"
            field="home_hero_image_url"
            hintText="Shown in the home page hero. Portrait photo."
          />
        </PageCard>

        {/* Commission page */}
        <PageCard title="Commission page" href="/commission">
          {capabilities.siteCopy ? (
            <SiteCopyFieldForm
              field="commission_intro"
              label="Opening paragraph"
              helper="The text under the Commissions heading"
              initialValue={settings?.commission_intro ?? SITE_COPY_DEFAULTS.commission_intro}
              defaultText={SITE_COPY_DEFAULTS.commission_intro}
              multiline
            />
          ) : (
            <p className="text-xs text-muted-foreground">{SCHEMA_SETUP_MESSAGE}</p>
          )}

          <SettingsImageField
            label="Photo at the top of the page"
            aspectRatio={16 / 9}
            currentImageUrl={settings?.commission_image_url ?? null}
            bucket="site-images"
            field="commission_image_url"
            hintText="Shown on the Commission page. Wide photo."
          />
        </PageCard>

        {/* Contact page */}
        <PageCard title="Contact page" href="/contact">
          {capabilities.siteCopy ? (
            <SiteCopyFieldForm
              field="contact_intro"
              label="Note above the contact form"
              initialValue={settings?.contact_intro ?? SITE_COPY_DEFAULTS.contact_intro}
              defaultText={SITE_COPY_DEFAULTS.contact_intro}
              multiline
            />
          ) : (
            <p className="text-xs text-muted-foreground">{SCHEMA_SETUP_MESSAGE}</p>
          )}
        </PageCard>

        {/* About page */}
        <PageCard title="About page" href="/about">
          <div className="flex items-center gap-4">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden bg-muted border border-border">
              {aboutImageUrl && (
                <Image
                  src={aboutImageUrl}
                  alt="Jamie Kendrioski"
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              )}
            </div>
            <div>
              <p className="text-sm font-medium mb-1">Bio &amp; photo</p>
              <Link
                href="/admin/bio"
                className="text-sm text-foreground underline underline-offset-4 hover:text-muted-foreground transition-colors"
              >
                Edit your bio &amp; photo →
              </Link>
            </div>
          </div>
        </PageCard>

        {/* Contact details */}
        <PageCard title="Contact details & email">
          <SettingsForm initialValues={settings} />
        </PageCard>
      </div>
    </div>
  )
}
