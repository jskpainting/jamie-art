/**
 * Generates PWA icons for Jamie Kendrioski's portfolio.
 * Uses sharp (transitive Next.js dep — no new install needed).
 *
 * Output:
 *   public/icon-192.png   192×192  (maskable + any)
 *   public/icon-512.png   512×512  (maskable + any)
 *   public/apple-touch-icon.png  180×180
 *
 * Run: node scripts/generate-pwa-icons.mjs
 */

import { createRequire } from "module"
import { fileURLToPath } from "url"
import path from "path"

const require = createRequire(import.meta.url)
const sharp = require("sharp")

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.resolve(__dirname, "../public")

// SVG source: white "JK" Fraunces-style serif on #FAFAF7 warm off-white
// Background fills the whole tile (safe-zone for maskable icons)
function makeSvg(size) {
  const fontSize = Math.round(size * 0.42)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#FAFAF7"/>
  <text
    x="50%"
    y="54%"
    dominant-baseline="middle"
    text-anchor="middle"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="${fontSize}"
    font-weight="400"
    letter-spacing="-2"
    fill="#0A0A0A"
  >JK</text>
</svg>`
}

async function generate(size, filename) {
  const svg = Buffer.from(makeSvg(size))
  await sharp(svg)
    .png()
    .toFile(path.join(publicDir, filename))
  console.log(`✓ ${filename} (${size}×${size})`)
}

await generate(512, "icon-512.png")
await generate(192, "icon-192.png")
await generate(180, "apple-touch-icon.png")

console.log("PWA icons generated.")
