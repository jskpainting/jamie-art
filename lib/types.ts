// Hand-written types matching BUILD_SPEC.md §5 schema exactly

export type PaintingStatus = "available" | "sold" | "nfs" | "reserved"
export type EventStatus = "upcoming" | "past" | "cancelled"
export type InquiryStatus = "new" | "replied" | "closed"

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
  created_at: string
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

export interface SectionWithCount extends Section {
  painting_count: number
}
