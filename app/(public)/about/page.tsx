import type { Metadata } from "next"
import Image from "next/image"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { getBio, getSettings } from "@/lib/db/queries"

export const metadata: Metadata = {
  title: "About",
  description:
    "About Jamie Kendrioski — Boston-based painter working in oils and acrylics.",
}

export default async function AboutPage() {
  const [bio, settings] = await Promise.all([getBio(), getSettings()])
  const profileImageUrl = settings?.about_image_url ?? null

  return (
    <div className="max-w-7xl mx-auto px-6 md:px-10 py-20 md:py-32">
      <p className="text-xs uppercase tracking-[0.2em] font-medium text-muted-foreground mb-3">
        About
      </p>
      <h1 className="text-3xl md:text-5xl tracking-tight font-light font-serif mb-12 md:mb-16">
        The Painter
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-12 lg:gap-16">
        {/* Profile photo — hidden entirely when no image set */}
        {profileImageUrl && (
          <div>
            <div className="relative aspect-square w-full max-w-sm overflow-hidden bg-muted">
              <Image
                src={profileImageUrl}
                alt="Jamie Kendrioski"
                fill
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                className="object-cover"
                priority
              />
            </div>
          </div>
        )}

        {/* Bio — spans full width if no profile image */}
        <div className={profileImageUrl ? "max-w-2xl" : "max-w-2xl lg:col-span-2"}>
          {bio?.short_statement && (
            <p className="text-xl md:text-2xl font-serif font-light leading-relaxed text-foreground mb-8">
              {bio.short_statement}
            </p>
          )}

          {bio?.body_markdown ? (
            <div className="prose dark:prose-invert prose-p:text-muted-foreground prose-p:leading-relaxed prose-headings:font-serif prose-headings:font-light max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {bio.body_markdown}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="space-y-4 text-base md:text-lg leading-relaxed text-muted-foreground">
              <p>
                Jamie Kendrioski has been making paintings that refuse to sit
                still — abstracts that breathe, cityscapes that hum, florals
                that insist on their own weight.
              </p>
              <p>
                Based in Boston, working in oils and acrylics with an eye for
                the places where light behaves unexpectedly.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
