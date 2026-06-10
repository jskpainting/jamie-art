// Phase 6A (temporary): copies sample_images/ into public/layout-samples/
// with URL-safe filenames so the layout-preview dev tool can serve them via
// next/image. Delete this script along with /admin/layout-preview.
import { cp, mkdir, readdir, rm } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"

const ROOT = path.resolve(import.meta.dirname, "..")
const SRC = path.join(ROOT, "sample_images")
const DEST = path.join(ROOT, "public", "layout-samples")

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"])

function slugify(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

if (!existsSync(SRC)) {
  console.log("sync-layout-samples: no sample_images/ directory, skipping")
  process.exit(0)
}

await rm(DEST, { recursive: true, force: true })
await mkdir(DEST, { recursive: true })

const entries = await readdir(SRC, { withFileTypes: true })
let copied = 0
for (const entry of entries) {
  if (!entry.isFile()) continue
  const ext = path.extname(entry.name).toLowerCase()
  if (!IMAGE_EXTENSIONS.has(ext)) continue
  const base = slugify(path.basename(entry.name, ext))
  await cp(path.join(SRC, entry.name), path.join(DEST, `${base}${ext}`))
  copied++
}

console.log(`sync-layout-samples: copied ${copied} image(s) to public/layout-samples/`)
