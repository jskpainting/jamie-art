// Hand-written types matching BUILD_SPEC.md §5 schema exactly

export type PaintingStatus = "available" | "sold" | "nfs" | "reserved"
export type EventStatus = "upcoming" | "current" | "past" | "cancelled"
export type InquiryStatus = "new" | "replied" | "closed"
export type CommissionInquiryStatus = "new" | "replied" | "closed"

export interface Section {
  id: string
  slug: string
  title: string
  description: string | null
  cover_image_url: string | null
  sort_order: number
  created_at: string
  cover_focal_x: number
  cover_focal_y: number
}

export interface Painting {
  id: string
  section_id: string
  slug: string
  title: string
  year: number | null
  medium: string | null
  dimensions: string | null
  price_cents: number | null
  status: PaintingStatus
  story: string | null
  story_public: boolean
  story_notes: string | null
  primary_image_url: string | null
  sort_order: number
  created_at: string
  width: number | null
  height: number | null
  print_available: boolean
  commission_available: boolean
  sold_at: string | null
}

export interface PaintingImage {
  id: string
  painting_id: string
  url: string
  alt: string | null
  sort_order: number
}

export interface Bio {
  id: string
  body_markdown: string | null
  short_statement: string | null
  headshot_url: string | null
  updated_at: string
  headshot_focal_x: number
  headshot_focal_y: number
}

export interface Event {
  id: string
  title: string
  starts_at: string
  ends_at: string | null
  location: string | null
  description: string | null
  link: string | null
  image_url: string | null
  status: EventStatus
  created_at: string
  image_focal_x: number
  image_focal_y: number
  // Optional — added by the RSVP migration (lib/schema-capabilities.ts `rsvp`).
  rsvp_enabled?: boolean
  rsvp_note?: string | null
  rsvp_limit?: number | null
}

export interface Contact {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  source: string
  tags: string[]
  subscribed: boolean
  unsubscribe_token: string
  created_at: string
  // Optional — added by the CRM migration (lib/schema-capabilities.ts `crm`).
  // Nullable/optional so existing code compiles before it runs.
  phone?: string | null
  city?: string | null
  notes?: string | null
  updated_at?: string | null
}

export type NewsletterStatus = "sending" | "completed" | "failed"

export interface Newsletter {
  id: string
  subject: string
  body_markdown: string
  body_html: string
  sent_at: string
  sent_by_user_email: string | null
  recipient_count: number
  status: NewsletterStatus
  error_message: string | null
  // Optional — added by the CRM/RSVP migration.
  event_id?: string | null
  audience?: NewsletterAudience | null
}

/** Who a newsletter send targeted — stored as jsonb on `newsletters.audience`. */
export type NewsletterAudience =
  | { type: "all" }
  | { type: "groups"; ids: string[]; label?: string }
  | { type: "tags"; names: string[]; label?: string }
  | { type: "people"; ids: string[]; label?: string }

export interface Inquiry {
  id: string
  painting_id: string | null
  from_email: string
  from_name: string | null
  message: string | null
  status: InquiryStatus
  created_at: string
}

// Joined / extended types
export interface PaintingWithSection extends Painting {
  section: Section
}

export interface PaintingWithImages extends Painting {
  painting_images: PaintingImage[]
}

export interface PaintingWithImagesAndTags extends PaintingWithImages {
  tags: string[]
  /** Additional galleries (beyond the home section_id) this painting is shown in. */
  extra_section_ids?: string[]
}

export interface SectionWithCount extends Section {
  painting_count: number
}

export interface InquiryWithPainting extends Inquiry {
  painting_title: string | null
  painting_slug: string | null
  painting_section_slug: string | null
}

export interface ContactsStats {
  total: number
  subscribed: number
  unsubscribed: number
}

export interface InquiriesStats {
  new_count: number
  replied_count: number
  closed_count: number
}

export interface Tag {
  id: string
  name: string
  created_at: string
}

export interface PaintingTag {
  painting_id: string
  tag_id: string
}

export type GalleryLayout = "pairs" | "mosaic" | "columns"

export interface Settings {
  id: string
  phone: string | null
  email: string | null
  instagram_handle: string | null
  newsletter_from_name: string | null
  home_hero_image_url: string | null
  about_image_url: string | null
  commission_image_url: string | null
  featured_painting_id: string | null
  // Optional editable site copy (fall back to built-in defaults when null).
  tagline?: string | null
  commission_eyebrow?: string | null
  commission_heading?: string | null
  commission_intro?: string | null
  contact_intro?: string | null
  // Optional "Ask about this painting" settings (fall back to built-in default
  // template / SMS-enabled=true when null/missing pre-migration).
  inquiry_message_template?: string | null
  inquiry_sms_enabled?: boolean | null
  updated_at: string
  home_hero_focal_x: number
  home_hero_focal_y: number
  commission_focal_x: number
  commission_focal_y: number
  active_layout: GalleryLayout
}

export interface CommissionInquiry {
  id: string
  from_name: string | null
  from_email: string
  from_phone: string | null
  message: string | null
  reference_painting_id: string | null
  reference_painting_title: string | null
  status: CommissionInquiryStatus
  created_at: string
}

export interface CommissionInquiriesStats {
  new_count: number
  replied_count: number
  closed_count: number
}

// ---------------------------------------------------------------------------
// CRM + RSVP (lib/schema-capabilities.ts `crm` / `rsvp`) — hand-written to
// mirror supabase/migrations/20260913150000_crm_rsvp.sql exactly.
// ---------------------------------------------------------------------------

export interface ContactGroup {
  id: string
  name: string
  description: string | null
  created_at: string
}

export interface Purchase {
  id: string
  contact_id: string
  painting_id: string | null
  title: string | null
  price_cents: number | null
  purchased_on: string | null
  notes: string | null
  created_at: string
}

export type ActivityKind =
  | "note"
  | "purchase"
  | "rsvp"
  | "newsletter"
  | "inquiry"
  | "signup"
  | "import"
  | "group"
  | "tag"

export interface ContactActivity {
  id: string
  contact_id: string
  kind: ActivityKind
  summary: string
  ref_id: string | null
  created_at: string
}

export type RsvpStatus = "invited" | "yes" | "no" | "maybe"

export interface EventRsvp {
  id: string
  event_id: string
  contact_id: string | null
  email: string
  name: string | null
  status: RsvpStatus
  guests: number
  source: "site" | "email" | "admin"
  token: string
  note: string | null
  created_at: string
  updated_at: string
}

/** A purchase with the referenced painting's display fields joined in. */
export interface PurchaseWithPainting extends Purchase {
  painting_title: string | null
  painting_slug: string | null
  painting_section_slug: string | null
}

/** An RSVP with the referenced event's display fields joined in. */
export interface RsvpWithEvent extends EventRsvp {
  event_title: string
  event_starts_at: string
}

/** Full detail view for `/admin/contacts/[id]`. */
export interface ContactDetail extends Contact {
  groups: ContactGroup[]
  purchases: PurchaseWithPainting[]
  rsvps: RsvpWithEvent[]
  inquiries: InquiryWithPainting[]
  commissionInquiries: CommissionInquiry[]
  newsletters: { id: string; subject: string; sent_at: string }[]
  activities: ContactActivity[]
}

/** Row shape for the People list table. */
export interface ContactRow extends Contact {
  group_names: string[]
  purchase_count: number
  last_activity_at: string | null
}
