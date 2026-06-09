import { z } from "zod"

export const BioSchema = z.object({
  headshot_url: z.string().nullable().optional(),
  short_statement: z.string().nullable().optional(),
  body_markdown: z.string().nullable().optional(),
})

export type BioInput = z.infer<typeof BioSchema>

export const SectionUpdateSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().nullable().optional(),
  cover_image_url: z.string().nullable().optional(),
})

export type SectionUpdateInput = z.infer<typeof SectionUpdateSchema>

export const ReorderSchema = z.object({
  ids: z.array(z.string().uuid()),
})

export type ReorderInput = z.infer<typeof ReorderSchema>

export const PaintingWriteSchema = z.object({
  section_id: z.string().uuid(),
  title: z.string().min(1, "Title is required"),
  slug: z.string().min(1, "Slug is required").regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only"),
  year: z.coerce.number().int().min(1800).max(2100).nullable().optional(),
  medium: z.string().nullable().optional(),
  dimensions: z.string().nullable().optional(),
  price_dollars: z
    .string()
    .optional()
    .transform((v) => {
      if (!v || v.trim() === "") return null
      const n = parseFloat(v)
      return isNaN(n) ? null : Math.round(n * 100)
    }),
  status: z.enum(["available", "sold", "nfs", "reserved"]).default("available"),
  story: z.string().nullable().optional(),
  primary_image_url: z.string().nullable().optional(),
})

export type PaintingWriteInput = z.infer<typeof PaintingWriteSchema>

export const PaintingImageSchema = z.object({
  url: z.string().min(1),
  alt: z.string().nullable().optional(),
})

export type PaintingImageInput = z.infer<typeof PaintingImageSchema>

export const EventWriteSchema = z.object({
  title: z.string().min(1, "Title is required"),
  starts_at: z.string().min(1, "Start date is required"),
  ends_at: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  link: z.string().nullable().optional(),
  image_url: z.string().nullable().optional(),
  status: z.enum(["upcoming", "past", "cancelled"]).default("upcoming"),
})

export type EventWriteInput = z.infer<typeof EventWriteSchema>

export const ContactWriteSchema = z.object({
  email: z.string().email("Valid email required"),
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
  source: z.string().default("manual"),
  tags: z.array(z.string()).default([]),
  subscribed: z.boolean().default(true),
})

export type ContactWriteInput = z.infer<typeof ContactWriteSchema>

export const ContactImportRowSchema = z.object({
  email: z.string().email(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
})

export type ContactImportRow = z.infer<typeof ContactImportRowSchema>

export const InquiryStatusSchema = z.enum(["new", "replied", "closed"])

export type InquiryStatusInput = z.infer<typeof InquiryStatusSchema>
