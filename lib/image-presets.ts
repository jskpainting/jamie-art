// Central registry of every image "slot" in the admin — what ratio it crops
// to, how large the source should be, how large the output can be, and which
// storage bucket it belongs in. `ImageUploadCropper` and the shared editor
// dialog read this instead of taking `aspectRatio`/`bucket` props directly,
// so every upload surface in the app stays consistent and a single place
// documents "where does this photo show up."

export type PresetKey =
  | "painting"
  | "paintingExtra"
  | "headshot"
  | "event"
  | "galleryCover"
  | "homeHero"
  | "commissionHero"
  | "siteImage"

export type Ratio = number | "free"

export type Bucket = "headshots" | "paintings" | "events" | "site-images"

export interface ImagePreset {
  key: PresetKey
  /** Shown in dialog titles / labels. */
  label: string
  /** The ratio preselected when the editor opens. */
  ratio: Ratio
  /** Additional ratio chips offered after the default, before "Free". */
  altRatios: Ratio[]
  /** Below this the amber "a bit small" nudge shows. Null = no minimum. */
  minPx: { width: number; height: number } | null
  /** Ceiling for the long edge of the rendered output. */
  maxOutputPx: number
  /** Owner-facing "where this shows up" copy. */
  hint: string
  bucket: Bucket
  /**
   * Paintings are never cropped by the site — the ratio-chip row is hidden
   * entirely for these presets and the editor only offers a free trim.
   */
  paintingRules?: boolean
}

export const IMAGE_PRESETS: Record<PresetKey, ImagePreset> = {
  painting: {
    key: "painting",
    label: "Painting photo",
    ratio: "free",
    altRatios: [],
    minPx: { width: 1600, height: 1600 },
    maxOutputPx: 4000,
    hint: "The main photo on the gallery wall and detail page. Never cropped by the site.",
    bucket: "paintings",
    paintingRules: true,
  },
  paintingExtra: {
    key: "paintingExtra",
    label: "Detail / framed shot",
    ratio: "free",
    altRatios: [],
    minPx: { width: 1200, height: 1200 },
    maxOutputPx: 4000,
    hint: "Extra photos on the painting's detail page — close-ups, framed, in-progress. Never cropped by the site.",
    bucket: "paintings",
    paintingRules: true,
  },
  headshot: {
    key: "headshot",
    label: "About photo",
    ratio: 4 / 5,
    altRatios: [1, "free"],
    minPx: { width: 1000, height: 1250 },
    maxOutputPx: 3000,
    hint: "Your portrait on the About page.",
    bucket: "headshots",
  },
  event: {
    key: "event",
    label: "Event image",
    ratio: 16 / 9,
    altRatios: [4 / 3, "free"],
    minPx: { width: 1600, height: 900 },
    maxOutputPx: 3000,
    hint: "The banner on an event card and its listing.",
    bucket: "events",
  },
  galleryCover: {
    key: "galleryCover",
    label: "Gallery cover",
    ratio: 4 / 3,
    altRatios: ["free"],
    minPx: { width: 1600, height: 1200 },
    maxOutputPx: 3000,
    hint: "The tile that represents this gallery on the Portfolio page.",
    bucket: "site-images",
  },
  homeHero: {
    key: "homeHero",
    label: "Home page photo",
    ratio: "free",
    altRatios: [],
    minPx: { width: 2000, height: 1200 },
    maxOutputPx: 4000,
    hint: "The large photo on the home page. Upload the full photo, then set the focal point below.",
    bucket: "site-images",
  },
  commissionHero: {
    key: "commissionHero",
    label: "Commission photo",
    ratio: "free",
    altRatios: [],
    minPx: { width: 2000, height: 1200 },
    maxOutputPx: 4000,
    hint: "The photo at the top of the Commission page.",
    bucket: "site-images",
  },
  siteImage: {
    key: "siteImage",
    label: "Library image",
    ratio: "free",
    altRatios: [1, 4 / 3, 16 / 9],
    minPx: null,
    maxOutputPx: 4000,
    hint: "A general-purpose image kept in your media library, reusable anywhere.",
    bucket: "site-images",
  },
}
