import { Nav } from "@/components/nav"
import { Footer } from "@/components/footer"
import { Toaster } from "@/components/ui/sonner"
import { getSettings } from "@/lib/db/queries"

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const settings = await getSettings()

  return (
    <>
      <Nav
        navSettings={{
          instagram_handle: settings?.instagram_handle ?? null,
          email: settings?.email ?? null,
        }}
      />
      <main className="flex-1">{children}</main>
      <Footer />
      <Toaster position="top-right" />
    </>
  )
}
