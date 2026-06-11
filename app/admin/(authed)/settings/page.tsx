import type { Metadata } from "next"
import { getSettings } from "@/lib/db/queries"
import { SettingsForm } from "./settings-form"

export const metadata: Metadata = {
  title: "Settings — Admin",
  robots: { index: false },
}

export default async function SettingsPage() {
  const settings = await getSettings()

  return (
    <div className="max-w-xl">
      <p className="text-xs uppercase tracking-[0.2em] font-medium text-muted-foreground mb-2">
        Settings
      </p>
      <h1 className="text-2xl md:text-3xl font-light font-serif tracking-tight mb-8">
        Site Settings
      </h1>
      <SettingsForm initialValues={settings} />
    </div>
  )
}
