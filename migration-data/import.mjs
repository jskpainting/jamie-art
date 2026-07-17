#!/usr/bin/env node
/**
 * Portfolio import — loads the 84 harvested paintings into Supabase (storage + paintings table).
 *
 * STAGED / NOT YET RUN. Requires a live Supabase project. Run from repo root:
 *   node migration-data/import.mjs           # dry run (no writes) — prints plan
 *   node migration-data/import.mjs --commit  # actually upload + insert
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY from .env.local.
 * Idempotent: skips a painting if one with the same (section, slug) already exists.
 * Section slugs in master.json (abstracts / cityscapes-seascapes / florals / pixels-rainbows)
 * must exist in the `sections` table.
 */
import { createClient } from "@supabase/supabase-js"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const COMMIT = process.argv.includes("--commit")
const REPLACE = process.argv.includes("--replace") // delete ALL existing paintings first
const BUCKET = "paintings"

// load env from .env.local
const env = Object.fromEntries(
  fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8")
    .split("\n").filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)
const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SECRET_KEY
if (!url || !key) { console.error("Missing Supabase env"); process.exit(1) }
const db = createClient(url, key, { auth: { persistSession: false } })

const records = JSON.parse(fs.readFileSync(path.join(__dirname, "master.json"), "utf8"))

function slugify(s) {
  return (s || "untitled").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "untitled"
}

async function main() {
  // 1. resolve section slug -> id
  const { data: sections, error: se } = await db.from("sections").select("id, slug")
  if (se) throw se
  const secId = Object.fromEntries(sections.map(s => [s.slug, s.id]))
  const missing = [...new Set(records.map(r => r.section))].filter(s => !secId[s])
  if (missing.length) { console.error("Sections not found in DB:", missing); process.exit(1) }

  // 2. REPLACE mode: delete all existing paintings (and dependent rows) first
  if (REPLACE) {
    const { data: old } = await db.from("paintings").select("id")
    const ids = (old || []).map(p => p.id)
    console.log(`${COMMIT ? "DELETING" : "WOULD DELETE"} ${ids.length} existing painting(s)`)
    if (COMMIT && ids.length) {
      await db.from("painting_images").delete().in("painting_id", ids)
      await db.from("painting_tags").delete().in("painting_id", ids)
      const { error: de } = await db.from("paintings").delete().in("id", ids)
      if (de) throw de
    }
  }

  // existing paintings for idempotency (empty after a committed replace)
  const { data: existing } = REPLACE && COMMIT ? { data: [] } : await db.from("paintings").select("section_id, slug")
  const have = new Set((existing || []).map(p => `${p.section_id}:${p.slug}`))

  const usedSlugs = {}
  let planned = 0, skipped = 0
  for (const r of records) {
    const section_id = secId[r.section]
    let slug = slugify(r.title)
    const kk = `${r.section}:${slug}`
    if (usedSlugs[kk]) { usedSlugs[kk]++; slug = `${slug}-${usedSlugs[kk]}` } else usedSlugs[kk] = 1
    if (have.has(`${section_id}:${slug}`)) { skipped++; continue }

    const ext = path.extname(r.local_file) || ".jpg"
    const storagePath = `${r.section}/${slug}${ext}`
    const row = {
      section_id, slug, title: r.title, year: r.year ?? null,
      medium: r.medium ?? null, dimensions: r.dimensions ?? null,
      price_cents: r.price_dollars ? r.price_dollars * 100 : null,
      status: r.status || "available",
      story: r.raw_caption || null, // full original caption, so it's visible/editable in admin

      width: r.real_width ?? null, height: r.real_height ?? null,
      sort_order: r.order,
    }
    console.log(`${COMMIT ? "IMPORT" : "PLAN  "} [${r.section}] ${row.title}  ${row.status}${row.price_cents ? " $" + r.price_dollars : ""}  -> ${storagePath}`)
    planned++

    if (COMMIT) {
      const buf = fs.readFileSync(path.join(__dirname, r.local_file))
      const { error: ue } = await db.storage.from(BUCKET).upload(storagePath, buf, {
        contentType: ext.toLowerCase() === ".png" ? "image/png" : "image/jpeg", upsert: true,
      })
      if (ue) { console.error("  upload failed:", ue.message); continue }
      const { data: pub } = db.storage.from(BUCKET).getPublicUrl(storagePath)
      const { error: ie } = await db.from("paintings").insert({ ...row, primary_image_url: pub.publicUrl })
      if (ie) console.error("  insert failed:", ie.message)
    }
  }
  console.log(`\n${COMMIT ? "Imported" : "Planned"}: ${planned}   Skipped (already present): ${skipped}   Total: ${records.length}`)
  if (!COMMIT) console.log("Dry run only. Re-run with --commit to write.")
}
main().catch(e => { console.error(e); process.exit(1) })
