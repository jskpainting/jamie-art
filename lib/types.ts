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
}

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
  updated_at: string
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
