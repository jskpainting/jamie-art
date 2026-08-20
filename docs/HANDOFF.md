# HANDOFF — current state & next steps

> **Read this first**, then `README.md`, `docs/BUILD_SPEC.md`, and `CLAUDE.md`.
> A new chat can start from here by saying "continue".

_Last updated: 2026-08-20._

---

## TL;DR

- The site is **LIVE and secured** at **https://www.jamiekendrioski.com**.
- **Deploy = `git push` to `main`** (Vercel auto-deploys in ~40–60s). Never use
  the Vercel CLI from this Mac — it's signed into a different account than the
  live project.
- `main` is green: `npm run build && npm run lint` both pass.
- ⚠️ **SQL rounds 2, 3 and 4 are NOT applied.** Verified missing on production:
  `webauthn_credentials`, `image_edits`, `settings.commission_heading`,
  `settings.inquiry_sms_enabled`, `paintings.story_public`. Passkeys, AI
  stories, quick-inquire settings and image editing are therefore correctly
  hidden behind `lib/schema-capabilities.ts` — that is not a bug. The
  copy-paste SQL is in `docs/RUN_THIS_SQL.md`.
- **85 paintings**: abstracts 51 · cityscapes-seascapes 14 · florals 8 ·
  pixels-rainbows 12. Use these counts as a data-integrity check.
- Other live counts: sections 5 · events 2 · contacts 7 · inquiries 4 ·
  commission_inquiries 3. **Zero rows** in `newsletters`, `painting_sections`,
  `painting_images`, `tags` and `painting_tags` — multi-gallery, per-painting
  extra images, tags and newsletters have never run with real data, so their
  first-row and empty-state paths are unexercised.

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
Event/Breadcrumb), `sitemap.xml` (95 URLs), `robots.txt`.

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
- **AR "View on my wall"** — true-size AR on painting pages via
  `<model-viewer>` + a generated GLB. `scripts/generate-ar-model.mjs
  <paintingId>` builds a quad at the painting's real dimensions and uploads to
  the public `ar-models` bucket; the button only renders when a model exists.
  Owner-confirmed working on iPhone. **82 of 85 paintings have a model.** The 3
  without (`globe-2`, `cityscape`, one `untitled`) have blank or unparseable
  `dimensions` — only the owner can supply the real sizes.
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
     | grep -oE "/portfolio/[a-z-]+/[a-z0-9-]+\"" | sort -u | wc -l   # 51
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

## Session 2026-08-20 — bugs found and fixed

A large multi-agent QA pass over the whole app. Six real defects were found,
fixed, verified and shipped. Every one was proved against the live site before
and after; the database fingerprint taken before the session was byte-identical
to the one taken after, so no real record was altered.

1. **Painting create, edit and bulk upload were broken on production.**
   `PaintingWriteSchema` had `story_public: z.boolean().default(true)`, and a
   Zod `.default()` is emitted on every parse — so the key was injected into
   every payload and spread into the insert. `paintings.story_public` does not
   exist (migration unrun), and PostgREST rejects the whole statement when a
   payload names a missing column. Broken since `a968e49`. The UI was gated on
   the `storyTools` capability; the write path was not. **Lesson: gate the
   WRITE path, not just the UI.**
2. **Sold paintings ignored the owner's gallery order.** Neither query feeding
   `twoTierSort` had an ORDER BY, and 71 of 74 sold paintings have
   `sold_at = NULL`, so they all compared equal and kept Postgres heap order —
   which reshuffles on any row update. Fixed with explicit
   `.order("sort_order").order("id")` plus a sort_order tiebreak.
3. **Event dates were timezone-dependent.** `formatEventDateRange` had no
   `timeZone`, so the server (UTC) and the browser disagreed: the home page and
   /events advertised different dates for the same show, /events claimed JPOS ran
   a day longer than it does, and React threw hydration error #418 on every load
   for non-UTC visitors. Now pinned to `EVENT_TIME_ZONE`.
4. **Cancelling an event deleted it from the admin permanently.** No query
   fetched `status='cancelled'`. Added `getCancelledEvents()` and an admin-only
   Cancelled section. The public site already excluded them correctly.
5. **Editing a contact re-subscribed opt-outs and wiped their tags.**
   `ContactWriteSchema.partial()` does not drop `.default()` values. Replaced
   with a defaults-free `ContactUpdateSchema`.
6. **A newsletter that delivered to nobody reported "Sent".** The Resend SDK
   returns `{ data: null, error }` rather than throwing, so the try/catch never
   fired and rejected emails counted as delivered.

Also shipped: search/filter/sort on the last three admin lists (galleries,
painting list, show cards), completing the rollout to all eight. On the two
drag-reorderable lists, sorting and filtering are strictly view-only and
dragging is switched off outside the owner's own view, with a "Back to my order"
control and disclosure of any selection the filter is hiding.

**Not verified, needs the owner:** AR on a real phone, and the "Send as a text"
button on a real device.

---

## Next steps (nothing is blocking)

1. **3 paintings still have no AR model** — `globe-2`, `cityscape` and one
   `untitled`, because their `dimensions` are blank or unparseable.
   `node scripts/generate-all-ar-models.mjs` regenerates everything and skips
   these. Ask the owner for the real sizes rather than guessing — a wrongly
   sized true-scale model is worse than none.
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
   admin email can burn the send quota (Supabase-side fix: enable CAPTCHA in
   Auth). Password login has since shipped, so email is no longer the only way
   in.
6. 🔴 **`RESEND_FROM_EMAIL` is not set**, so newsletter sending falls back to
   Resend's `onboarding@resend.dev` sandbox sender, which only delivers to the
   Resend account owner. Sending now refuses up front with a plain-English
   message rather than firing every email into the void, but the owner must set
   this to an address on a verified domain before any real campaign.
7. **Contacts contain QA pollution** — 5 of the 7 rows are `@example.com` test
   addresses (`test+newsletter@`, `qa-test@`, `ratelimit-test@`,
   `verify-newcode@`, `www-verify@`), 4 of them marked subscribed. Only 2 are
   real people. The owner should decide what to delete.
8. **Backlog**: replace the placeholder `public/og-image.png` with a real
   painting; submit the sitemap in Search Console.

## Operational facts

- **GitHub**: `jskpainting/jamie-art` (`main`). **Supabase**: project ref
  `vrobiibybhyhvaoydfzj`. Storage buckets: `paintings`, `headshots`, `events`,
  `site-images`, `ar-models`.
- **Admin login emails** (`ADMIN_EMAILS` + Supabase users) are *separate* from
  the **public contact email** (`settings.email`, editable in admin Settings).
- ✅ **Supabase signups are now DISABLED.** Verified 2026-08-20 via
  `/auth/v1/settings` → `"disable_signup": true`. This was previously listed
  as the one open security task; it is done.
