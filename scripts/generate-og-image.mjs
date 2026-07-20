/**
 * Generates the default Open Graph / Twitter share image (1200×630).
 * Uses sharp (transitive Next.js dep — no new install needed).
 *
 * Output: public/og-image.png
 *
 * This is a tasteful placeholder wordmark card. The OWNER should replace it
 * with a real 1200×630 share image featuring an actual painting when available.
 *
 * Run: node scripts/generate-og-image.mjs
 */

import { createRequire } from "module"
import { fileURLToPath } from "url"
import path from "path"

const require = createRequire(import.meta.url)
const sharp = require("sharp")

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.resolve(__dirname, "../public")

const W = 1200
const H = 630

// Warm off-white background (#FAFAF7), near-black serif wordmark (#0A0A0A),
// matching the site's light-mode design tokens.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#FAFAF7"/>
  <rect x="60" y="60" width="${W - 120}" height="${H - 120}" fill="none" stroke="#E8E5DD" stroke-width="2"/>
  <text x="50%" y="46%" text-anchor="middle" dominant-baseline="middle"
    font-family="Georgia, 'Times New Roman', serif" font-size="96" font-weight="400"
    letter-spacing="-2" fill="#0A0A0A">Jamie Kendrioski</text>
  <text x="50%" y="60%" text-anchor="middle" dominant-baseline="middle"
    font-family="Helvetica, Arial, sans-serif" font-size="30" font-weight="500"
    letter-spacing="8" fill="#6B6B66">PAINTER · BOSTON · OILS &amp; ACRYLICS</text>
</svg>`

await sharp(Buffer.from(svg)).png().toFile(path.join(publicDir, "og-image.png"))
console.log("✓ og-image.png (1200×630)")
