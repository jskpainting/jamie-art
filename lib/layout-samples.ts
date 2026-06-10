// Phase 6A (temporary): server-only helper for the /admin/layout-preview dev
// tool. Reads public/layout-samples/ (populated by scripts/sync-layout-samples.mjs
// via predev/prebuild) and extracts intrinsic dimensions with sharp.
// Delete alongside /admin/layout-preview.
import { readdir } from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"

export interface SampleImage {
  src: string
  width: number
  height: number
  alt: string
}

const SAMPLES_DIR = path.join(process.cwd(), "public", "layout-samples")
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"])

function altFromFilename(filename: string): string {
  const base = path.basename(filename, path.extname(filename))
  return base
    .replace(/-\d+$/, "") // strip trailing copy counters like "-1"
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export async function getSampleImages(): Promise<SampleImage[]> {
  let files: string[]
  try {
    files = await readdir(SAMPLES_DIR)
  } catch {
    return []
  }

  const imageFiles = files
    .filter((f) => IMAGE_EXTENSIONS.has(path.extname(f).toLowerCase()))
    .sort()

  const images = await Promise.all(
    imageFiles.map(async (file): Promise<SampleImage | null> => {
      try {
        const { width, height } = await sharp(
          path.join(SAMPLES_DIR, file)
        ).metadata()
        if (!width || !height) return null
        return {
          src: `/layout-samples/${file}`,
          width,
          height,
          alt: altFromFilename(file),
        }
      } catch {
        return null
      }
    })
  )

  return images.filter((img): img is SampleImage => img !== null)
}
