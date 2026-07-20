// Generate a GLB "canvas in the room" 3D model for a painting and upload it to
// the public `ar-models` Supabase bucket as `<painting_id>.glb`.
//
// The model is a single flat quad, textured with the painting image, sized to
// the painting's REAL physical dimensions (so it appears true-to-scale in AR).
// model-viewer serves this GLB to Android Scene Viewer and auto-generates the
// iOS USDZ (AR Quick Look) from it — no separate USDZ file needed.
//
// Usage: node scripts/generate-ar-model.mjs <paintingId>
//   (looks the painting up in Supabase for its image + dimensions)

import sharp from "sharp"
import { readFileSync } from "node:fs"

// --- tiny .env.local loader (only what we need) ---
const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=")
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    })
)
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY
const IN_TO_M = 0.0254
const F32 = 5126,
  U16 = 5123,
  ARRAY_BUFFER = 34962,
  ELEMENT_ARRAY_BUFFER = 34963

function parsePhysical(dimensions) {
  if (!dimensions) return null
  const nums = (dimensions.match(/\d+(?:\.\d+)?/g) ?? []).map(Number)
  if (nums.length < 2 || nums[0] <= 0 || nums[1] <= 0) return null
  return [nums[0], nums[1]]
}

function pad4(n) {
  return (4 - (n % 4)) % 4
}

/** Build a GLB (ArrayBuffer) for a wOverH-proportioned quad of physical size w×h metres. */
function buildGlb(jpeg, wMeters, hMeters) {
  const hw = wMeters / 2
  const hh = hMeters / 2
  // 4 verts: bottom-left, bottom-right, top-right, top-left (facing +Z)
  const positions = new Float32Array([
    -hw, -hh, 0, hw, -hh, 0, hw, hh, 0, -hw, hh, 0,
  ])
  const normals = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1])
  // glTF UV origin = top-left, so top verts map to v=0
  const uvs = new Float32Array([0, 1, 1, 1, 1, 0, 0, 0])
  const indices = new Uint16Array([0, 1, 2, 0, 2, 3])

  const posB = Buffer.from(positions.buffer)
  const norB = Buffer.from(normals.buffer)
  const uvB = Buffer.from(uvs.buffer)
  const idxB = Buffer.from(indices.buffer)

  const oPos = 0
  const oNor = oPos + posB.length
  const oUv = oNor + norB.length
  const oIdx = oUv + uvB.length
  const oImg = oIdx + idxB.length + pad4(oIdx + idxB.length)
  const binLen = oImg + jpeg.length
  const bin = Buffer.alloc(binLen + pad4(binLen))
  posB.copy(bin, oPos)
  norB.copy(bin, oNor)
  uvB.copy(bin, oUv)
  idxB.copy(bin, oIdx)
  jpeg.copy(bin, oImg)

  const gltf = {
    asset: { version: "2.0", generator: "jamie-art-ar" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: "painting" }],
    meshes: [
      {
        primitives: [
          {
            attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 },
            indices: 3,
            material: 0,
          },
        ],
      },
    ],
    materials: [
      {
        name: "art",
        pbrMetallicRoughness: {
          baseColorTexture: { index: 0 },
          metallicFactor: 0,
          roughnessFactor: 0.85,
        },
        doubleSided: true,
      },
    ],
    textures: [{ source: 0, sampler: 0 }],
    images: [{ bufferView: 4, mimeType: "image/jpeg" }],
    samplers: [
      { magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: F32,
        count: 4,
        type: "VEC3",
        min: [-hw, -hh, 0],
        max: [hw, hh, 0],
      },
      { bufferView: 1, componentType: F32, count: 4, type: "VEC3" },
      { bufferView: 2, componentType: F32, count: 4, type: "VEC2" },
      { bufferView: 3, componentType: U16, count: 6, type: "SCALAR" },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: oPos, byteLength: posB.length, target: ARRAY_BUFFER },
      { buffer: 0, byteOffset: oNor, byteLength: norB.length, target: ARRAY_BUFFER },
      { buffer: 0, byteOffset: oUv, byteLength: uvB.length, target: ARRAY_BUFFER },
      { buffer: 0, byteOffset: oIdx, byteLength: idxB.length, target: ELEMENT_ARRAY_BUFFER },
      { buffer: 0, byteOffset: oImg, byteLength: jpeg.length },
    ],
    buffers: [{ byteLength: bin.length }],
  }

  let json = Buffer.from(JSON.stringify(gltf), "utf8")
  if (pad4(json.length)) json = Buffer.concat([json, Buffer.alloc(pad4(json.length), 0x20)])

  const header = Buffer.alloc(12)
  header.writeUInt32LE(0x46546c67, 0) // "glTF"
  header.writeUInt32LE(2, 4)
  header.writeUInt32LE(12 + 8 + json.length + 8 + bin.length, 8)

  const jsonChunkHeader = Buffer.alloc(8)
  jsonChunkHeader.writeUInt32LE(json.length, 0)
  jsonChunkHeader.writeUInt32LE(0x4e4f534a, 4) // "JSON"

  const binChunkHeader = Buffer.alloc(8)
  binChunkHeader.writeUInt32LE(bin.length, 0)
  binChunkHeader.writeUInt32LE(0x004e4942, 4) // "BIN\0"

  return Buffer.concat([header, jsonChunkHeader, json, binChunkHeader, bin])
}

async function main() {
  const paintingId = process.argv[2]
  if (!paintingId) throw new Error("Usage: node scripts/generate-ar-model.mjs <paintingId>")

  const h = { apikey: KEY, Authorization: `Bearer ${KEY}` }
  const res = await fetch(
    `${SUPA}/rest/v1/paintings?id=eq.${paintingId}&select=title,dimensions,primary_image_url`,
    { headers: h }
  )
  const [p] = await res.json()
  if (!p) throw new Error("Painting not found")
  const dims = parsePhysical(p.dimensions)
  if (!dims) throw new Error(`Painting "${p.title}" has no parseable dimensions ("${p.dimensions}")`)
  if (!p.primary_image_url) throw new Error("Painting has no image")

  const [wIn, hIn] = dims
  console.log(`▸ ${p.title} — ${wIn}"×${hIn}" (${(wIn * IN_TO_M).toFixed(3)}×${(hIn * IN_TO_M).toFixed(3)} m)`)

  // Fetch + downscale the image (long side ≤ 1400) as JPEG to keep the GLB small.
  const imgBuf = Buffer.from(await (await fetch(p.primary_image_url)).arrayBuffer())
  const jpeg = await sharp(imgBuf)
    .rotate()
    .resize(1400, 1400, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 86 })
    .toBuffer()
  console.log(`  texture ${(jpeg.length / 1024).toFixed(0)} KB`)

  const glb = buildGlb(jpeg, wIn * IN_TO_M, hIn * IN_TO_M)
  console.log(`  GLB ${(glb.length / 1024).toFixed(0)} KB`)

  const up = await fetch(`${SUPA}/storage/v1/object/ar-models/${paintingId}.glb`, {
    method: "POST",
    headers: { ...h, "Content-Type": "model/gltf-binary", "x-upsert": "true" },
    body: glb,
  })
  if (!up.ok) throw new Error(`Upload failed ${up.status}: ${await up.text()}`)
  console.log(`✓ uploaded ar-models/${paintingId}.glb`)
  console.log(`  ${SUPA}/storage/v1/object/public/ar-models/${paintingId}.glb`)
}

main().catch((e) => {
  console.error("✗", e.message)
  process.exit(1)
})
