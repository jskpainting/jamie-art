# HANDOFF — current state & next steps

> **Read this first**, then `README.md`, `docs/BUILD_SPEC.md`, and `CLAUDE.md`.
> A new chat can start from here by saying "continue".

_Last updated: 2026-08-18._

---

## TL;DR

- The site is **LIVE and secured** at **https://www.jamiekendrioski.com**.
- **Deploy = `git push` to `main`** (Vercel auto-deploys in ~40–60s). Never use
  the Vercel CLI from this Mac — it's signed into a different account than the
  live project.
- `main` is green: `npm run build && npm run lint` both pass.
- **All migrations are applied.** No pending owner SQL.
- 84 paintings: abstracts 50 · cityscapes-seascapes 14 · florals 8 ·
  pixels-rainbows 12. Use these counts as a data-integrity check.

## The owner

Non-technical, communicates by voice-to-text (transcripts are garbled — infer
intent, ask when genuinely ambiguous). Wants to run the whole site himself from
`/admin`. **Everything publicly visible should be editable from the admin
panel** — that is a standing goal, not a one-off request. Avoid jargon in admin
UI labels ("Site copy" was rejected; group by page instead).

---

## Shipped (all live)

**Public site** — editorial home hero, portfolio (2-per-row true-scale wall),
painting detail pages, about, events, commission, contact, newsletter,
inquiries. SEO: metadata, canonicals, OG, JSON-LD (Person/WebSite/VisualArtwork/
Event/Breadcrumb), `sitemap.xml` (94 URLs), `robots.txt`.

**Admin** — dashboard, bio, portfolio CRUD (drag-reorder, bulk actions, bulk
upload), events, contacts (CSV import), inquiries, newsletters (Resend), images
library, gallery layout, settings.

**Recent feature work**
- **Focal points** — click the important part of a photo (usually a face) and
  crops keep it visible. `lib/focal.ts` + `components/admin/focal-point-picker.tsx`.
  Wired for: home hero, commission hero, bio headshot, gallery covers, event
  images. Owner-confirmed working.
- **Image library** — `/admin/media` lists every uploaded image (recursive
  storage walk, ~116), plus "Choose from library" on every image field.
  Deleting an in-use image is blocked and says where it's used.
- **Gallery layout switcher** — `/admin/layout-preview` ("Gallery layout"):
  preview A/B/C, "Make this the site layout" + Undo, "Live now" badge.
  `settings.active_layout` drives `components/gallery/section-gallery.tsx`.
  **Currently `pairs`** = the two-per-row wall.
- **AR "View on my wall"** — true-size AR on painting pages via `<model-viewer>`
  + a generated GLB. `scripts/generate-ar-model.mjs <paintingId>` builds a quad
  at the painting's real dimensions and uploads to the public `ar-models`
  bucket; the button only renders when a model exists. Owner-confirmed working
  on iPhone. **Currently only ~6 abstracts have models** — see Next steps.
- **Settings = "Edit your site"** — one card per public page, plain labels, text
  boxes pre-filled with the current effective copy (`lib/site-copy.ts` holds the
  shared defaults; saving a value equal to the default stores `null`).
- **Multi-gallery** — `painting_sections` join table lets one painting appear in
  several galleries ("Also show in" in the Move dialog). Table is applied but
  **still has 0 rows — the feature has never run with real data.**

---

## 🔴 Hard-won gotchas (read before touching the data layer)

1. **A green build proves almost nothing.** Query failures are caught and turned
   into `[]`, so the site goes *empty* while `build`, `lint`, and `tsc` all pass.
   **Always verify by counting real rendered content** on localhost *and*
   production after any DB/query change:
   ```bash
   curl -s https://www.jamiekendrioski.com/portfolio/abstracts \
     | grep -oE "/portfolio/[a-z-]+/[a-z0-9-]+\"" | sort -u | wc -l   # 50
   curl -s https://www.jamiekendrioski.com/portfolio | grep -c "Collections coming soon"
   ```
2. **Adding a join table breaks implicit PostgREST embeds.** `painting_sections`
   created a second `paintings`↔`sections` path, so both
   `.select("*, sections(slug)")` **and** `.select("*, paintings(count)")` began
   failing with `PGRST201`. This caused **two separate production outages**
   (empty galleries; then `/portfolio` showing "Collections coming soon" plus an
   empty admin section list, broken bulk-upload selector, and missing sitemap
   URLs). Fixed by pinning every embed to the FK:
   `sections!paintings_section_id_fkey(...)` / `paintings!paintings_section_id_fkey(...)`.
   **Before adding any FK/join table, grep every `.select(` embed touching those
   tables.**
3. **Never run destructive tests on live data.** A move-test once left a painting
   in the wrong gallery. Use read-only probes; if you must write, restore
   immediately and re-verify the per-section counts above.
4. **Don't `rm -rf .next` or repeatedly kill the dev server** while the owner is
   watching it. `lib/*` edits don't reliably hot-reload — restart once, or trust
   `npm run build`.
5. **The sandbox browser is unreliable** (`Viewport: 0x0`, hung panes after tab
   churn). Prefer `curl` + SSR HTML assertions; open a fresh tab when needed.
6. **Migrations are manual.** Write the SQL into `supabase/migrations/`, then
   give the owner a copy-paste block (`docs/RUN_THIS_SQL.md`) and gate the UI on
   `lib/schema-capabilities.ts` so nothing errors before it's run.

---

## Next steps (nothing is blocking)

1. **Roll AR out to all 84 paintings.** Only ~6 abstracts have GLB models.
   `scripts/generate-ar-model.mjs` works per-painting; batch it over every
   painting with parseable `dimensions` (~96% qualify) and skip failures.
2. **Exercise multi-gallery for real** — add a painting to a second gallery via
   the Move dialog's "Also show in", then verify it renders in both galleries and
   that its canonical URL still points at its home gallery.
3. **Soft-404**: `/portfolio/<bogus>` returns HTTP 200 (correct "not found" UI,
   wrong status). Root cause: `app/(public)/loading.tsx` flushes the Suspense
   shell before `notFound()` runs. SEO-only, user-invisible — deliberately
   deprioritized.
4. **Set `NEXT_PUBLIC_SITE_URL`** in the Vercel dashboard. Origins are now
   unified on `lib/site.ts` (`SITE_URL`), but the env var should still be set
   explicitly in production.
5. **Login rate limit.** Magic-link OTP is public, so an attacker who knows the
   admin email can burn the send quota and lock the owner out (Supabase-side
   fix: enable CAPTCHA in Auth; custom SMTP via Resend is already configured).
   Optional code fix the owner has been offered: **add password login** as a
   fallback so email is never the only way in.
6. **Backlog**: `RESEND_FROM_EMAIL` domain verification; replace the placeholder
   `public/og-image.png` with a real painting; submit the sitemap in Search
   Console.

## Operational facts

- **GitHub**: `jskpainting/jamie-art` (`main`). **Supabase**: project ref
  `vrobiibybhyhvaoydfzj`. Storage buckets: `paintings`, `headshots`, `events`,
  `site-images`, `ar-models`.
- **Admin login emails** (`ADMIN_EMAILS` + Supabase users) are *separate* from
  the **public contact email** (`settings.email`, editable in admin Settings).
- ⛔ **Supabase signups are still enabled.** Turning them off (Auth → Sign In /
  Providers → User Signups OFF → **Save**) remains the one open security task;
  RLS trusts any authenticated user. Verify via `/auth/v1/settings`
  (`disable_signup`).
