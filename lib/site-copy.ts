// Default copy for editable public-page text. These are the strings the site
// shows when the matching `settings`/`bio` field is empty. Centralized here so
// the public pages AND the admin editor share ONE source of truth: the editor
// seeds each box with the current effective text (saved value ?? default), so
// the owner always sees and edits the real sentence instead of a blank box.
//
// On save, if the owner's text equals the default we store null again (see
// updateSiteCopy) — keeping "using the default" distinct from a real override.

export const SITE_COPY_DEFAULTS = {
  // Under the name in the top nav / mobile menu (components/nav.tsx)
  tagline_nav: "Painter · Boston",
  // Under the name on the home hero (components/hero-section.tsx)
  tagline_hero: "Painter · Boston · Oils & Acrylics",
  // Small-caps label above the heading on the Commission page (app/(public)/commission/page.tsx)
  commission_eyebrow: "Commissions",
  // <h1> on the Commission page (app/(public)/commission/page.tsx)
  commission_heading: "Commissions",
  // Opening paragraph on the Commission page (app/(public)/commission/page.tsx)
  commission_intro:
    "Jamie takes a limited number of commissions each year. Tell him what you have in mind — size, subject, palette, where it’ll live — and he’ll be in touch.",
  // Note above the form on the Contact page (app/(public)/contact/page.tsx)
  contact_intro:
    "Have a question about a painting, want to discuss a commission, or just want to say hello? Send a note and Jamie will reply within a few days.",
} as const

export type SiteCopyKey = keyof typeof SITE_COPY_DEFAULTS
