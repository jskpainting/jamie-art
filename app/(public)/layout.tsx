import { Nav } from "@/components/nav"
import { Footer } from "@/components/footer"
import { Toaster } from "@/components/ui/sonner"

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <Nav />
      <main className="flex-1">{children}</main>
      <Footer />
      <Toaster />
    </>
  )
}
