// Batch-generate AR models for every painting that has an image + parseable
// dimensions, skipping ones that already have a model unless --force is passed.
//
// Usage:
//   node scripts/generate-all-ar-models.mjs           # only missing models
//   node scripts/generate-all-ar-models.mjs --force   # regenerate everything
//   node scripts/generate-all-ar-models.mjs --limit 5 # cap (useful for a smoke test)
//
// Prints one line per painting and a summary. Safe to re-run: uploads use
// x-upsert, and nothing is written to the DB (models are keyed by painting id).

import { readFileSync } from "node:fs"
import { execFile } from "node:child_process"
import { promisify } from "node:util"

const run = promisify(execFile)

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
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` }

const force = process.argv.includes("--force")
const limitFlag = process.argv.indexOf("--limit")
const limit = limitFlag !== -1 ? Number(process.argv[limitFlag + 1]) : Infinity

function parsePhysical(dimensions) {
  if (!dimensions) return null
  const nums = (dimensions.match(/\d+(?:\.\d+)?/g) ?? []).map(Number)
  if (nums.length < 2 || nums[0] <= 0 || nums[1] <= 0) return null
  return [nums[0], nums[1]]
}

async function existingModels() {
  const res = await fetch(`${SUPA}/storage/v1/object/list/ar-models`, {
    method: "POST",
    headers: { ...H, "Content-Type": "application/json" },
    body: JSON.stringify({ prefix: "", limit: 1000 }),
  })
  if (!res.ok) return new Set()
  const rows = await res.json()
  return new Set(rows.map((r) => r.name.replace(/\.glb$/i, "")))
}

async function main() {
  const paintings = await (
    await fetch(
      `${SUPA}/rest/v1/paintings?select=id,slug,title,dimensions,primary_image_url&order=created_at`,
      { headers: H }
    )
  ).json()

  const have = force ? new Set() : await existingModels()

  const eligible = []
  const skipped = { noImage: [], noDims: [], already: [] }

  for (const p of paintings) {
    if (!p.primary_image_url) skipped.noImage.push(p.slug)
    else if (!parsePhysical(p.dimensions)) skipped.noDims.push(`${p.slug} ("${p.dimensions ?? ""}")`)
    else if (have.has(p.id)) skipped.already.push(p.slug)
    else eligible.push(p)
  }

  const todo = eligible.slice(0, limit)
  console.log(
    `${paintings.length} paintings · ${todo.length} to generate · ` +
      `${skipped.already.length} already have models · ` +
      `${skipped.noDims.length} unusable dimensions · ${skipped.noImage.length} no image\n`
  )

  let ok = 0
  const failed = []
  for (const [i, p] of todo.entries()) {
    const n = `${i + 1}/${todo.length}`
    try {
      await run("node", ["scripts/generate-ar-model.mjs", p.id], {
        cwd: new URL("..", import.meta.url).pathname,
        maxBuffer: 10 * 1024 * 1024,
      })
      ok++
      console.log(`  ✓ ${n} ${p.slug}`)
    } catch (e) {
      failed.push(p.slug)
      console.log(`  ✗ ${n} ${p.slug} — ${String(e.stderr || e.message).trim().split("\n").pop()}`)
    }
  }

  console.log(`\nDone. ${ok} generated, ${failed.length} failed.`)
  if (failed.length) console.log("Failed: " + failed.join(", "))
  if (skipped.noDims.length)
    console.log("\nNo usable dimensions (add them in admin to enable AR):\n  " + skipped.noDims.join("\n  "))
}

main().catch((e) => {
  console.error("✗", e.message)
  process.exit(1)
})
