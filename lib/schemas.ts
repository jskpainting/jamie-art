import { z } from "zod"

export const FocalSchema = z.number().min(0).max(100)

export const BioSchema = z.object({
  headshot_url: z.string().nullable().optional(),
  short_statement: z.string().nullable().optional(),
  body_markdown: z.string().nullable().optional(),
  headshot_focal_x: FocalSchema.optional(),
  headshot_focal_y: FocalSchema.optional(),
})

export type BioInput = z.infer<typeof BioSchema>

export const SectionUpdateSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().nullable().optional(),
  cover_image_url: z.string().nullable().optional(),
})

export type SectionUpdateInput = z.infer<typeof SectionUpdateSchema>

export const SectionWriteSchema = z.object({
  title: z.string().min(1, "Title is required"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only"),
  description: z.string().nullable().optional(),
  cover_image_url: z.string().nullable().optional(),
  cover_focal_x: FocalSchema.optional(),
  cover_focal_y: FocalSchema.optional(),
})

export type SectionWriteInput = z.infer<typeof SectionWriteSchema>

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
  // NOT .default(true): Zod would then inject this key into every payload, and a
  // payload naming a column that does not exist makes PostgREST reject the whole
  // statement. The story columns ship behind a migration the owner runs by hand.
  story_public: z.boolean().optional(),
  story_notes: z.string().nullable().optional(),
  primary_image_url: z.string().nullable().optional(),
  print_available: z.boolean().default(false),
  commission_available: z.boolean().default(false),
  width: z.coerce.number().int().positive().nullable().optional(),
  height: z.coerce.number().int().positive().nullable().optional(),
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
  link: z
    .string()
    .nullable()
    .optional()
    .transform((v) => {
      if (!v || !v.trim()) return null
      const trimmed = v.trim()
      if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed
      return `https://${trimmed}`
    }),
  image_url: z.string().nullable().optional(),
  status: z.enum(["upcoming", "current", "past", "cancelled"]).default("upcoming"),
  image_focal_x: FocalSchema.optional(),
  image_focal_y: FocalSchema.optional(),
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

export const TagNameSchema = z
  .string()
  .min(1, "Tag must be at least 1 character")
  .max(50, "Tag must be 50 characters or fewer")
  .trim()
  .toLowerCase()

export type TagNameInput = z.infer<typeof TagNameSchema>

export const TagNamesSchema = z.array(TagNameSchema)

export const CommissionInquiryWriteSchema = z.object({
  from_name: z.string().max(200).nullable().optional(),
  from_email: z.string().email("Valid email required").max(320),
  from_phone: z.string().max(50).nullable().optional(),
  message: z
    .string()
    .min(10, "Please write at least 10 characters")
    .max(5000, "Message is too long"),
  reference_painting_title: z.string().max(300).nullable().optional(),
  reference_painting_id: z.string().uuid().nullable().optional(),
})

export type CommissionInquiryWriteInput = z.infer<typeof CommissionInquiryWriteSchema>

export const InquiryStatusSchema = z.enum(["new", "replied", "closed"])

export type InquiryStatusInput = z.infer<typeof InquiryStatusSchema>

export const SettingsSchema = z.object({
  phone: z
    .string()
    .min(1, "Phone is required")
    .regex(/^\+\d{10,15}$/, "Must be E.164 format e.g. +15551234567"),
  email: z
    .string()
    .min(1, "Email is required")
    .email("Valid email required"),
  instagram_handle: z
    .string()
    .nullable()
    .optional()
    .transform((v) => {
      if (!v) return null
      // Accept anything the user pastes: @handle, full profile URL, or bare username.
      let h = v.trim()
      if (h === "") return null
      // Strip an instagram host if a URL was pasted, with or without protocol.
      h = h.replace(/^(https?:\/\/)?(www\.)?instagram\.com\//i, "")
      // Strip any leading @ and surrounding slashes / query strings.
      h = h.replace(/^@+/, "").replace(/[/?#].*$/, "").replace(/\/+$/, "").trim()
      return h === "" ? null : h
    }),
  newsletter_from_name: z.string().nullable().optional(),
})

export type SettingsInput = z.infer<typeof SettingsSchema>
// Raw form-field shape (before the instagram_handle transform runs).
export type SettingsFormValues = z.input<typeof SettingsSchema>

export const GalleryLayoutSchema = z.enum(["pairs", "mosaic", "columns"])

export const QuickInquireSettingsSchema = z.object({
  inquiry_message_template: z.string().max(2000).nullable().optional(),
  inquiry_sms_enabled: z.boolean().optional(),
})

export type QuickInquireSettingsInput = z.infer<typeof QuickInquireSettingsSchema>

export const EditRecipeSchema = z.object({
  crop: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    })
    .nullable(),
  brightness: z.number().min(0.5).max(1.5),
  contrast: z.number().min(0.5).max(1.5),
})

export const ImageEditSchema = z.object({
  bucket: z.string().min(1),
  path: z.string().min(1),
  source_bucket: z.string().min(1),
  source_path: z.string().min(1),
  recipe: EditRecipeSchema,
})

export type ImageEditInput = z.infer<typeof ImageEditSchema>
