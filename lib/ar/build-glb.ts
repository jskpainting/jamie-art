/**
 * Pure GLB builder for the "canvas in the room" AR model, ported verbatim
 * from scripts/generate-ar-model.mjs (see that file's header for the
 * background). Kept dependency-free — this is just glTF/GLB byte packing.
 *
 * See lib/ar/generate.ts for the server-side pipeline that calls this
 * (fetch painting → resize image → buildGlb → upload).
 */

const IN_TO_M = 0.0254
const F32 = 5126,
  U16 = 5123,
  ARRAY_BUFFER = 34962,
  ELEMENT_ARRAY_BUFFER = 34963

export { IN_TO_M }

/**
 * Public URL of a painting's AR GLB model. Pure string-building (no sharp /
 * admin-client dependency) so it is safe to import from client components —
 * e.g. the admin painting list's "3D ready" HEAD check.
 */
export function arModelPublicUrl(paintingId: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  return `${base}/storage/v1/object/public/ar-models/${paintingId}.glb`
}

/** Parse [widthIn, heightIn] from a dimensions string like `24"x36"`. */
export function parsePhysicalInches(
  dimensions: string | null
): [number, number] | null {
  if (!dimensions) return null
  const nums = (dimensions.match(/\d+(?:\.\d+)?/g) ?? []).map(Number)
  if (nums.length < 2 || nums[0] <= 0 || nums[1] <= 0) return null
  return [nums[0], nums[1]]
}

function pad4(n: number): number {
  return (4 - (n % 4)) % 4
}

/** Build a GLB (Buffer) for a wOverH-proportioned quad of physical size w×h metres. */
export function buildGlb(
  jpeg: Uint8Array | Buffer,
  widthMeters: number,
  heightMeters: number
): Buffer {
  const jpegBuf = Buffer.isBuffer(jpeg) ? jpeg : Buffer.from(jpeg)
  const wMeters = widthMeters
  const hMeters = heightMeters
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
  const binLen = oImg + jpegBuf.length
  const bin = Buffer.alloc(binLen + pad4(binLen))
  posB.copy(bin, oPos)
  norB.copy(bin, oNor)
  uvB.copy(bin, oUv)
  idxB.copy(bin, oIdx)
  jpegBuf.copy(bin, oImg)

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
      { buffer: 0, byteOffset: oImg, byteLength: jpegBuf.length },
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
