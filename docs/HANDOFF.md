# HANDOFF — current state & next steps

> **Read this first**, then `README.md`, `docs/BUILD_SPEC.md`, and `CLAUDE.md`.
> A new chat can start from here by saying "continue".

_Last updated: 2026-09-13._

---

## TL;DR

- The site is **LIVE and secured** at **https://www.jamiekendrioski.com**.
- **Deploy = `git push` to `main`** (Vercel auto-deploys in ~40–60s). Never use
  the Vercel CLI from this Mac — it's signed into a different account than the
  live project.
- `main` is green: `npm run build && npm run lint` both pass.
- ✅ **All SQL rounds are applied**, including Round 4 (`field_options`,
  `image_edits`) and Round 5 (`crm_rsvp`: groups, purchases, activities,
  `event_rsvps`, `newsletter_recipients`). Verified against
  `docs/RUN_THIS_SQL.md` — nothing is pending. `lib/schema-capabilities.ts`
  still gates each feature's UI defensively, but there is no known-missing
  column left.
- **103 paintings**: abstracts 50 · cityscapes-seascapes 17 · florals 8 ·
  pixels-rainbows 12 · uncategorized/"Archives (2018-2021)" 16. Use these
  counts as a data-integrity check.
- **AR "View on my wall" models: 101 of 103.** `cityscape` and `untitled-2`
  (in Florals) still have no usable `dimensions`, so they have no model —
  only the owner can supply the real sizes (`docs/ACTION_ITEMS.md` #1). Globe
  2 is done — it was measured and its model generated on 2026-09-13.
- The `uncategorized` slug is now editable; the holding bucket is re-created
  automatically when a gallery is deleted (`lib/actions/sections.ts`
  `deleteSection`).
- **Newsletter AI drafting needs a key.** Neither `GEMINI_API_KEY` nor
  `GROQ_API_KEY` is set, so "Write it for me" on the Newsletters page shows
  the setup sentence instead of drafting. See `docs/AI_SETUP.md` and
  `docs/ACTION_ITEMS.md` #2.
- **The AI story writer was removed at the owner's request.** Painting
  descriptions are human-written again; the `storyTools` capability now only
  gates the "show this story on the website" toggle, not any AI generation.

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
  `<model-viewer>` + a generated GLB. `lib/ar/build-glb.ts` +
  `lib/ar/generate.ts` (`generateArModel`) build a quad at the painting's real
  dimensions and upload to the public `ar-models` bucket; the button only
  renders when a model exists. Models are now generated **automatically** —
  `createPainting`, `updatePainting` and `bulkCreatePaintings`
  (`lib/actions/paintings.ts`) trigger `generateArModel` via `after()` from
  `next/server` after a successful write, so saving stays fast and a missing
  or changed photo/size regenerates the model without any manual step. The
  admin painting list also has a "Rebuild 3D model" button
  (`regenerateArModel`) for a manual, synchronous rebuild, plus a "3D
  ready"/"No 3D yet" chip per row. `scripts/generate-ar-model.mjs` and
  `scripts/generate-all-ar-models.mjs` remain as thin CLI wrappers (duplicated
  logic, kept in sync by hand) for manual batch runs. Owner-confirmed working
  on iPhone. **100 of 103 paintings have a model.** The 3 without (`globe-2`,
  `cityscape`, `untitled-2`) have blank or unparseable `dimensions` — only the
  owner can supply the real sizes (see `docs/ACTION_ITEMS.md` #1).
- **Settings = "Edit your site"** — one card per public page, plain labels, text
  boxes pre-filled with the current effective copy (`lib/site-copy.ts` holds the
  shared defaults; saving a value equal to the default stores `null`).
- **Multi-gallery** — `painting_sections` join table lets one painting appear in
  several galleries ("Also show in" in the Move dialog). Table is applied but
  **still has 0 rows — the feature has never run with real data.**

**Session 2026-09-13** (large multi-agent phase, see `docs/PLAN_2026-09-13.md`,
`docs/PLAN_BULK_UPLOAD.md`, `docs/PLAN_TAGS.md`, `docs/PLAN_NEWSLETTER_AI.md`,
`docs/PLAN_CRM_EVENTS.md`)
- Admin dialogs now all scroll on small screens; the "Uncategorized" gallery's
  slug is editable (becomes public the moment it's renamed).
- Medium and Size are dropdowns with recent-first ordering and "Other…",
  backed by `field_options` and managed from a new Settings card.
- AR 3D wall models now generate automatically after every painting save
  (`after()` hook in `lib/actions/paintings.ts`) — no manual script run
  needed. `sharp` pinned as a direct dependency so this works on Vercel.
- Show cards redesigned painting-first with two shape-aware layouts (A:
  side-by-side for square/tall, B: stacked for wide).
- Fixed height-first entered sizes (e.g. `36"x24"` meant as height×width)
  rotating the AR model or mis-scaling it on the wall — `orientPhysical` in
  `lib/mosaic-layout.ts` now lets the photo's own aspect ratio decide.
- Bulk upload rebuilt phone-first: uploads go straight to Supabase Storage via
  a signed URL (`lib/storage/upload.ts`, `app/api/admin/upload-url/`),
  client-side shrinking, honest per-file error messages, progress, retries,
  and a proper default gallery (no longer the hidden "uncategorized" bucket).
- Captions unified into one format (`lib/painting-caption.ts`) shown with
  price on show cards and the public site.
- Tags: a Settings card to manage the tag list, and a pick-from-list-or-"Other"
  picker on each painting and in bulk upload; "Related work" uses tags when
  two paintings share one.
- Images: a general bulk "Upload photos" flow (progress, retries, plain
  English errors) alongside the painting-specific one.
- Painting pages: "View on my wall" now opens AR directly, gated to phones
  that actually support it.
- Newsletters: an AI "Write it for me" drafter (needs a key — see TL;DR), a
  formatting toolbar, inserting a painting into the body, and "send a test to
  me"; plus choosing who a newsletter goes to (all subscribers, a group, a
  tag, or hand-picked people) with per-recipient event-invite RSVP buttons.
- People (renamed from Contacts): groups, tags, purchase history, an activity
  timeline per person, a richer CSV import, and a "Sold to" picker on the
  painting dialog that logs a purchase.
- Events: an RSVP switch, one-tap RSVP links for invited people, a public RSVP
  page/form for everyone else, and an admin RSVP list per event.
- The AI story writer was **removed** at the owner's request — painting
  descriptions are written by hand again.

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
7. **Vercel serverless functions reject request bodies over ~4.5 MB** before the
   route even runs (`FUNCTION_PAYLOAD_TOO_LARGE`, plain-text 413) — this is why
   phone photos sent raw through `/api/admin/upload` used to fail about half
   the time. Every upload surface now shrinks the photo client-side
   (`lib/image-shrink.ts`) and uploads it straight to Supabase Storage with a
   signed URL from `/api/admin/upload-url` (`lib/storage/upload.ts`), so Vercel
   is never in the byte path. `/api/admin/upload` still exists for the
   cropper's internal "crops" folder writes made server-side elsewhere — don't
   remove it.
8. **Sizes are often entered height×width, not width×height.** Don't assume a
   fixed order when parsing `dimensions` — let the photo's own pixel aspect
   ratio decide which number is which. `orientPhysical` in
   `lib/mosaic-layout.ts` does this; reuse it rather than re-deriving
   orientation from the typed string.
9. **Never put `export type` re-exports in a `"use server"` file.** Next
   treats every export of such a file as a server action, including type
   re-exports, and this 500'd the RSVP routes. Keep type-only exports in a
   separate non-`"use server"` module and import from there.
10. **Client components must not import `lib/schema-capabilities.ts`** — it's
    server-only (uses the admin DB client). A client component that needs the
    setup message should duplicate `SCHEMA_SETUP_MESSAGE` locally rather than
    importing it.

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

1. **2 paintings still have no AR model** — `cityscape` and `untitled-2` (in
   Florals), because their `dimensions` are blank or unparseable. Ask the
   owner for the real sizes rather than guessing — a wrongly sized true-scale
   model is worse than none. `node scripts/generate-all-ar-models.mjs`
   regenerates everything and skips these.
2. **Add a free AI key for the newsletter drafter** — neither
   `GEMINI_API_KEY` nor `GROQ_API_KEY` is set. See `docs/AI_SETUP.md`.
3. 🔴 **`RESEND_FROM_EMAIL` is not set / domain not verified**, so newsletter
   sending falls back to Resend's `onboarding@resend.dev` sandbox sender,
   which only delivers to the Resend account owner. Sending refuses up front
   with a plain-English message rather than firing every email into the void,
   but the owner must verify the domain and set this env var before any real
   campaign. Details in `docs/ACTION_ITEMS.md` #3.
4. **Test on a real phone** — bulk upload (the new phone-first flow), an RSVP
   link (both the one-tap invited-person link and the public form), and "View
   on my wall" AR. Only the owner can verify these.
5. **Exercise multi-gallery, People/CRM and RSVP for real** — `painting_sections`,
   `contact_groups`, `purchases`, `event_rsvps` etc. are applied but largely
   unexercised with real data; verify each end-to-end once real usage starts.
6. **Soft-404**: `/portfolio/<bogus>` returns HTTP 200 (correct "not found" UI,
   wrong status). Root cause: `app/(public)/loading.tsx` flushes the Suspense
   shell before `notFound()` runs. SEO-only, user-invisible — deliberately
   deprioritized.
7. **Set `NEXT_PUBLIC_SITE_URL`** in the Vercel dashboard. Origins are now
   unified on `lib/site.ts` (`SITE_URL`), but the env var should still be set
   explicitly in production.
8. **Login rate limit.** Magic-link OTP is public, so an attacker who knows the
   admin email can burn the send quota (Supabase-side fix: enable CAPTCHA in
   Auth). Password login has since shipped, so email is no longer the only way
   in.
9. **Backlog**: replace the placeholder `public/og-image.png` with a real
   painting; submit the sitemap in Search Console.

## Captions

Every painting's `story` field is meant to hold the owner's one-line caption —
e.g. `What Remains Standing (2026). 12"x36" Acrylic on canvas. $875 (+tax)` or
`Vortex (2023). 36"x36" Acrylic on canvas. SOLD` — built from title, year,
dimensions, medium, price and status. The format lives in
`lib/painting-caption.ts` (`captionFor`, `captionDetailsFor` for the part after
the title, `normalizeDimensions`, `looksLikeCaption`), and both the show card
(`components/print/show-card.tsx`) and the painting save path read from it so
the card, the site, and the stored `story` never drift apart. `createPainting`
and `bulkCreatePaintings` (`lib/actions/paintings.ts`) auto-fill `story` from
`captionFor` when the incoming value is empty; `updatePainting` refreshes it on
save only when the previous story was empty or still looked like a
machine-generated caption *and* the owner didn't hand-edit the story text in
that same save — real hand-written prose is never touched. `dimensions` is
normalized (e.g. `12” x 12”` → `12"x12"`) on every write.

## Operational facts

- **GitHub**: `jskpainting/jamie-art` (`main`). **Supabase**: project ref
  `vrobiibybhyhvaoydfzj`. Storage buckets: `paintings`, `headshots`, `events`,
  `site-images`, `ar-models`.
- **Admin login emails** (`ADMIN_EMAILS` + Supabase users) are *separate* from
  the **public contact email** (`settings.email`, editable in admin Settings).
- ✅ **Supabase signups are now DISABLED.** Verified 2026-08-20 via
  `/auth/v1/settings` → `"disable_signup": true`. This was previously listed
  as the one open security task; it is done.
