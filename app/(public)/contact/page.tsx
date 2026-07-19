import type { Metadata } from "next"
import { ContactForm } from "@/components/contact-form"
import { NewsletterForm } from "@/components/newsletter-form"
import { getSettings } from "@/lib/db/queries"

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Get in touch with Jamie Kendrioski — inquiries, commissions, and mailing list.",
}

export default async function ContactPage() {
  const settings = await getSettings()

  return (
    <div className="max-w-7xl mx-auto px-6 md:px-10 py-20 md:py-32">
      <p className="text-xs uppercase tracking-[0.2em] font-medium text-muted-foreground mb-3">
        Contact
      </p>
      <h1 className="text-3xl md:text-5xl tracking-tight font-light font-serif mb-4 md:mb-5">
        Get in Touch
      </h1>

      {settings?.email && (
        <p className="text-sm text-muted-foreground mb-12 md:mb-16">
          Or email directly:{" "}
          <a
            href={`mailto:${settings.email}`}
            className="text-foreground hover:underline underline-offset-4 transition-colors"
          >
            {settings.email}
          </a>
        </p>
      )}

      {!settings?.email && (
        <div className="mb-12 md:mb-16" />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24">
        {/* Contact form */}
        <div>
          <p className="text-base text-muted-foreground mb-8 leading-relaxed whitespace-pre-line">
            {settings?.contact_intro?.trim() ||
              "Have a question about a painting, want to discuss a commission, or just want to say hello? Send a note and Jamie will reply within a few days."}
          </p>
          <ContactForm />
        </div>

        {/* Newsletter */}
        <div>
          <div className="rounded-2xl border border-border p-8">
            <h2 className="font-serif text-xl font-light mb-2">Stay in the loop</h2>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              Be the first to hear about new work, upcoming shows, and studio
              news. No spam, ever — just paintings.
            </p>
            <NewsletterForm layout="stacked" placeholder="your@email.com" />
          </div>
        </div>
      </div>
    </div>
  )
}
