import type { Metadata } from "next"
import { getSettings } from "@/lib/db/queries"
import { SettingsForm } from "./settings-form"
import { ImageCropUploader } from "@/components/admin/image-crop-uploader"

export const metadata: Metadata = {
  title: "Settings — Admin",
  robots: { index: false },
}

export default async function SettingsPage() {
  const settings = await getSettings()

  return (
    <div className="max-w-2xl">
      <p className="text-xs uppercase tracking-[0.2em] font-medium text-muted-foreground mb-2">
        Settings
      </p>
      <h1 className="text-2xl md:text-3xl font-light font-serif tracking-tight mb-8">
        Site Settings
      </h1>
      <SettingsForm initialValues={settings} />

      <div className="mt-12 pt-10 border-t border-border">
        <h2 className="text-lg font-medium mb-1">Images</h2>
        <p className="text-sm text-muted-foreground mb-8">
          Each image is saved independently — no need to click &ldquo;Save settings&rdquo;.
        </p>
        <div className="flex flex-col gap-10">
          <ImageCropUploader
            label="Home hero image"
            aspectRatio={3 / 4}
            currentImageUrl={settings?.home_hero_image_url ?? null}
            bucket="site-images"
            field="home_hero_image_url"
            hintText="Shown in the home page hero. 3:4 portrait. Overrides the auto-pulled painting."
          />
          <ImageCropUploader
            label="About profile photo"
            aspectRatio={1}
            currentImageUrl={settings?.about_image_url ?? null}
            bucket="headshots"
            field="about_image_url"
            hintText="Shown on the About page. Square."
          />
          <ImageCropUploader
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
