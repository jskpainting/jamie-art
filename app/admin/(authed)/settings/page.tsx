import type { Metadata } from "next"
import { getSettings, getAllPaintingsForPicker } from "@/lib/db/queries"
import { getSchemaCapabilities } from "@/lib/schema-capabilities"
import { SettingsForm } from "./settings-form"
import { SiteCopyForm } from "./site-copy-form"
import { FeaturedPaintingPickerForm } from "./featured-painting-picker-form"
import { SettingsImageField } from "./settings-image-field"

export const metadata: Metadata = {
  title: "Settings — Admin",
  robots: { index: false },
}

export default async function SettingsPage() {
  const [settings, paintings, capabilities] = await Promise.all([
    getSettings(),
    getAllPaintingsForPicker(),
    getSchemaCapabilities(),
  ])

  return (
    <div className="max-w-2xl">
      <p className="text-xs uppercase tracking-[0.2em] font-medium text-muted-foreground mb-2">
        Settings
      </p>
      <h1 className="text-2xl md:text-3xl font-light font-serif tracking-tight mb-8">
        Site Settings
      </h1>
      <SettingsForm initialValues={settings} />

      {capabilities.siteCopy && (
        <div className="mt-12 pt-10 border-t border-border">
          <h2 className="text-lg font-medium mb-1">Site copy</h2>
          <p className="text-sm text-muted-foreground mb-8">
            Editable text shown on the public site. Leave any field blank to use
            the built-in default.
          </p>
          <SiteCopyForm initialValues={settings} />
        </div>
      )}

      <div className="mt-12 pt-10 border-t border-border">
        <h2 className="text-lg font-medium mb-1">Images</h2>
        <p className="text-sm text-muted-foreground mb-8">
          Each image is saved independently — no need to click &ldquo;Save settings&rdquo;.
        </p>
        <div className="flex flex-col gap-10">
          {/* Featured painting picker */}
          <div>
            <p className="text-sm font-medium mb-1">Featured painting</p>
            <FeaturedPaintingPickerForm
              paintings={paintings}
              initialId={settings?.featured_painting_id ?? null}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              If a custom image is uploaded below, it takes priority. Otherwise this painting will
              be featured on the home page. If neither is set, the latest available abstract is used.
            </p>
          </div>

          <SettingsImageField
            label="Home hero image"
            aspectRatio={3 / 4}
            currentImageUrl={settings?.home_hero_image_url ?? null}
            bucket="site-images"
            field="home_hero_image_url"
            hintText="Shown in the home page hero. 3:4 portrait. Overrides the auto-pulled painting."
          />
          <SettingsImageField
            label="Commission page hero"
            aspectRatio={16 / 9}
            currentImageUrl={settings?.commission_image_url ?? null}
            bucket="site-images"
            field="commission_image_url"
            hintText="Shown on the Commission page. 16:9 wide."
          />
        </div>
      </div>
    </div>
  )
}
