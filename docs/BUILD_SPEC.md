# Jamie Kendrioski Art Portfolio — Build Spec

> Single source of truth for the project. Save as `docs/BUILD_SPEC.md` in the
> repo. Feed to Claude Code on Mac Mini at the start of each build phase.

---

## 1. Project context

Replacing Jamie's current Square Online site at jamiekendrioski.com.

**Pain points being solved**
- Painting thumbnails are cropped/cut in the current grid
- No detail page per painting (only thumbnails)
- No way to add title, medium, dimensions, price, story
- No content management without Square Online's UI
- Site is heavily JS-rendered — even Google can't crawl it properly

**Goals**
- Editorial, gallery-grade design where the paintings are the focus
- Full painting detail pages with shareable URLs
- Admin portal Jamie can use from his phone
- Newsletter contact-list management with CSV import
- Future-ready: inquiries, sales status, newsletter sends

---

## 2. Information architecture

```
/                                    Home (hero + bio teaser + featured + events)
/portfolio                           Grid of 4 sections
/portfolio/abstracts                 Abstracts gallery
/portfolio/cityscapes-seascapes      Cityscapes/Seascapes gallery
/portfolio/florals                   Florals gallery
/portfolio/pixels-rainbows           Pixels & Rainbows gallery
/portfolio/[section]/[slug]          Individual painting detail (NEW capability)
/about                               Bio + headshot + statement
/events                              Upcoming + past shows
/contact                             Contact form + mailing list signup
```

Admin (auth-gated):
```
/admin/login
/admin                               Dashboard
/admin/bio
/admin/portfolio                     Sections overview
/admin/portfolio/[section]           Paintings CRUD in section
/admin/events
/admin/contacts                      List + CSV import
/admin/inquiries
/admin/settings                      Phone, email, Instagram handle, newsletter from-name
```

In production, Vercel middleware rewrites `admin.jamiekendrioski.com/*` → `/admin/*`.
Locally, hit `localhost:7847/admin` directly.

---

## 3. Tech stack

- **Next.js 15** (App Router) + TypeScript
- **Tailwind v4** + **shadcn/ui** (New York style, neutral base)
- **Supabase** — Postgres + Auth (magic link) + Storage for painting images
- **Framer Motion** — page transitions, scroll reveals
- **next-themes** — light/dark mode persistence
- **React Hook Form + Zod** — admin forms
- **Resend** — newsletter sends (future)
- **papaparse** — CSV import for contacts

Local dev port: **7847**

---

## 4. Design system

### 4.1 Color tokens

Light mode:
```css
--background: 60 14% 97%;       /* #FAFAF7 warm off-white */
--foreground: 0 0% 4%;          /* #0A0A0A near-black */
--card: 0 0% 100%;              /* #FFFFFF */
--card-foreground: 0 0% 4%;
--muted: 48 14% 94%;            /* #F4F2EC */
--muted-foreground: 48 4% 41%;  /* #6B6B66 */
--border: 48 17% 89%;           /* #E8E5DD */
--input: 48 17% 89%;
--accent: 60 3% 24%;            /* #3D3D3A */
--primary: 0 0% 4%;
--primary-foreground: 60 14% 97%;
--ring: 60 3% 24%;
```

Dark mode:
```css
--background: 60 4% 6%;         /* #0F0F0E deep ink, NOT pure black */
--foreground: 48 26% 94%;       /* #F5F3EC */
--card: 60 4% 10%;              /* #1A1A18 */
--card-foreground: 48 26% 94%;
--muted: 60 4% 12%;             /* #1F1F1D */
--muted-foreground: 48 4% 62%;  /* #A1A09A */
--border: 60 4% 16%;            /* #2A2A27 */
--input: 60 4% 16%;
--accent: 48 12% 81%;           /* #D4D2CB */
--primary: 48 26% 94%;
--primary-foreground: 60 4% 6%;
--ring: 48 12% 81%;
```

Both modes preserve painting color fidelity — no overlays, no filters on `<img>`.

### 4.2 Typography

- **Display / headings**: Fraunces (Google Fonts, variable, weights 300–700)
- **Body / UI**: Inter (Google Fonts, variable, weights 400–600)
- **Mono** (inquiry IDs, code): JetBrains Mono

Type scale (Tailwind classes):
```
H1 display:   text-5xl md:text-7xl tracking-tight font-light font-serif
H2 section:   text-3xl md:text-5xl tracking-tight font-light font-serif
H3 card:      text-xl md:text-2xl font-medium
Body:         text-base md:text-lg leading-relaxed
Eyebrow:      text-xs uppercase tracking-[0.2em] font-medium
```

### 4.3 Motion

- Page transitions: 400ms ease-out, fade + 8px y-translate
- Scroll reveals: Framer Motion `whileInView` with `once: true`, 600ms
- Image lightbox: 300ms scale + opacity
- Theme toggle: 200ms color transition on `:root`
- Reduced-motion: respect `prefers-reduced-motion`

### 4.4 Layout primitives

```
Container:       max-w-7xl mx-auto px-6 md:px-10
Section padding: py-20 md:py-32
Grid gap:        gap-6 md:gap-10
Card radius:     rounded-2xl
```

---

## 5. Supabase schema

```sql
-- Enable extensions
create extension if not exists "pgcrypto";

-- Sections (portfolio categories)
create table sections (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text,
  cover_image_url text,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- Paintings
create table paintings (
  id uuid primary key default gen_random_uuid(),
  section_id uuid references sections(id) on delete cascade,
  slug text not null,
  title text not null,
  year int,
  medium text,
  dimensions text,
  price_cents int,
  status text default 'available'
    check (status in ('available','sold','nfs','reserved')),
  story text,
  primary_image_url text,
  sort_order int default 0,
  created_at timestamptz default now(),
  unique(section_id, slug)
);

-- Multiple images per painting (detail shots, framed views)
create table painting_images (
  id uuid primary key default gen_random_uuid(),
  painting_id uuid references paintings(id) on delete cascade,
  url text not null,
  alt text,
  sort_order int default 0
);

-- Bio (single row)
create table bio (
  id uuid primary key default gen_random_uuid(),
  body_markdown text,
  short_statement text,
  headshot_url text,
  updated_at timestamptz default now()
);

-- Events
create table events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  description text,
  link text,
  image_url text,
  status text default 'upcoming'
    check (status in ('upcoming','past','cancelled')),
  created_at timestamptz default now()
);

-- Newsletter contacts
create table contacts (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  first_name text,
  last_name text,
  source text default 'manual',
  tags text[] default '{}',
  subscribed boolean default true,
  unsubscribe_token uuid default gen_random_uuid() not null,
  created_at timestamptz default now(),
  constraint contacts_unsub_token_unique unique (unsubscribe_token)
);

-- Newsletter sends audit log (Phase 6D-1)
create table newsletters (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  body_markdown text not null,
  body_html text not null,
  sent_at timestamptz default now(),
  sent_by_user_email text,
  recipient_count int not null,
  status text default 'completed'
    check (status in ('sending','completed','failed')),
  error_message text
);

-- Inquiries from "inquire about this piece"
create table inquiries (
  id uuid primary key default gen_random_uuid(),
  painting_id uuid references paintings(id) on delete set null,
  from_email text not null,
  from_name text,
  message text,
  status text default 'new'
    check (status in ('new','replied','closed')),
  created_at timestamptz default now()
);

-- Row Level Security
alter table sections      enable row level security;
alter table paintings     enable row level security;
alter table painting_images enable row level security;
alter table bio           enable row level security;
alter table events        enable row level security;
alter table contacts      enable row level security;
alter table inquiries     enable row level security;

-- Public read on portfolio + bio + events
create policy "public read sections"  on sections     for select using (true);
create policy "public read paintings" on paintings    for select using (true);
create policy "public read images"    on painting_images for select using (true);
create policy "public read bio"       on bio          for select using (true);
create policy "public read events"    on events       for select using (true);

-- Public insert on inquiries (for "inquire" form)
create policy "public insert inquiries" on inquiries for insert with check (true);

-- Authenticated users (Jamie) can do everything
create policy "auth all sections"   on sections     for all using (auth.role() = 'authenticated');
create policy "auth all paintings"  on paintings    for all using (auth.role() = 'authenticated');
create policy "auth all images"     on painting_images for all using (auth.role() = 'authenticated');
create policy "auth all bio"        on bio          for all using (auth.role() = 'authenticated');
create policy "auth all events"     on events       for all using (auth.role() = 'authenticated');
create policy "auth all contacts"   on contacts     for all using (auth.role() = 'authenticated');
create policy "auth all inquiries"  on inquiries    for all using (auth.role() = 'authenticated');

-- Settings (single row — see also Phase 6C-6 migration for image columns)
create table settings (
  id uuid primary key default gen_random_uuid(),
  phone text,
  email text,
  instagram_handle text,
  newsletter_from_name text,
  home_hero_image_url text,       -- overrides auto-pulled painting on home hero
  about_image_url text,           -- profile photo on About page
  commission_image_url text,      -- 16:9 hero on Commission page
  featured_painting_id uuid references paintings(id) on delete set null, -- specific painting pinned to hero
  updated_at timestamptz default now()
);

-- Seed sections
insert into sections (slug, title, sort_order) values
  ('abstracts', 'Abstracts', 1),
  ('cityscapes-seascapes', 'Cityscapes / Seascapes', 2),
  ('florals', 'Florals', 3),
  ('pixels-rainbows', 'Pixels & Rainbows', 4);

-- Seed empty bio row
insert into bio (body_markdown, short_statement) values ('', '');
```

Storage buckets:
- `paintings` — public read, authenticated write
- `headshots` — public read, authenticated write (also used for `about_image_url` from settings)
- `events` — public read, authenticated write
- `site-images` — public read, authenticated write (home hero + commission hero)

---

## 6. File structure

```
jamie-art/
├── app/
│   ├── (public)/
│   │   ├── layout.tsx                  Nav + footer + theme provider
│   │   ├── page.tsx                    Home
│   │   ├── portfolio/
│   │   │   ├── page.tsx                4 section cards
│   │   │   └── [section]/
│   │   │       ├── page.tsx            Painting grid
│   │   │       └── [slug]/page.tsx     Painting detail
│   │   ├── about/page.tsx
│   │   ├── events/page.tsx
│   │   └── contact/page.tsx
│   ├── admin/
│   │   ├── login/page.tsx              Magic link (standalone — no sidebar)
│   │   ├── auth/signout/route.ts       POST → signOut
│   │   └── (authed)/                   Route group — transparent in URL
│   │       ├── layout.tsx              requireUser() + AdminShell
│   │       ├── page.tsx                /admin dashboard
│   │       ├── bio/page.tsx
│   │       ├── portfolio/page.tsx
│   │       ├── events/page.tsx
│   │       ├── contacts/page.tsx       + CSV import (Phase 4)
│   │       └── inquiries/page.tsx
│   ├── auth/
│   │   └── callback/route.ts           Magic-link code exchange
│   ├── api/
│   │   └── inquiries/route.ts          Public POST endpoint
│   ├── globals.css                     Tailwind + tokens
│   └── layout.tsx                      Root (fonts, metadata)
├── components/
│   ├── ui/                             shadcn
│   ├── nav.tsx
│   ├── footer.tsx
│   ├── theme-toggle.tsx
│   ├── painting-card.tsx
│   ├── painting-lightbox.tsx
│   ├── section-card.tsx
│   ├── event-card.tsx
│   ├── newsletter-form.tsx
│   └── admin/
│       ├── sidebar.tsx
│       ├── image-uploader.tsx
│       └── csv-importer.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts                   Browser client
│   │   ├── server.ts                   Server client
│   │   ├── middleware.ts               Session refresh helper (returns { response, user })
│   │   └── auth.ts                     getUser() + requireUser() server helpers
│   ├── db/
│   │   └── queries.ts                  Typed query helpers
│   ├── types.ts                        Generated DB types
│   └── utils.ts                        cn(), formatPrice(), etc.
├── proxy.ts                            Session refresh + admin auth gate (Next.js 16)
├── docs/
│   └── BUILD_SPEC.md                   This file
└── .env.local                          NEVER commit (gitignored)
```

---

## 7. Build phases

### Phase 1 — Foundation
- `globals.css` with design tokens + Fraunces/Inter font setup
- Root layout with `ThemeProvider` (next-themes)
- `<Nav>`, `<Footer>`, `<ThemeToggle>` components
- Empty pages for all public routes (so navigation works)
- shadcn baseline components installed
- Lib: `cn()`, `formatPrice()`, basic utils

### Phase 2 — Public site
- Home: hero with Jamie's name in Fraunces, bio teaser, featured paintings carousel, upcoming events strip
- `/portfolio` — 4 section cards with cover images, hover state, sort_order from DB
- `/portfolio/[section]` — painting grid with `object-cover` thumbnails + click-to-lightbox
- `/portfolio/[section]/[slug]` — full-bleed image, metadata block, story, inquire CTA, related pieces
- `/about` — markdown-rendered bio + headshot
- `/events` — upcoming + past, grouped
- `/contact` — form + newsletter signup

### Phase 3 — Auth + admin shell
- Supabase Auth setup (magic link, no passwords)
- Admin layout with sidebar
- Login page → email → magic link → dashboard
- Auth guard in middleware
- Logout

### Phase 4 — Admin CRUD
- Bio editor (markdown textarea + headshot upload)
- Sections list → click into section
- Paintings CRUD inside a section
  - Drag-to-reorder (dnd-kit)
  - Image upload to Supabase Storage
  - All metadata fields
  - Status dropdown (available/sold/nfs/reserved)
- Events CRUD
- Contacts list + CSV/Excel import (papaparse, dedupe by email)
- Inquiries list (read-only + mark replied/closed)

### Phase 5 — Deployment
- Create Jamie's accounts (GitHub, Supabase, Vercel) under his new email
- Migrate repo to Jamie's GitHub
- Re-create Supabase project under Jamie's account, run migrations
- Connect Jamie's Vercel to his GitHub repo
- Set env vars in Vercel dashboard
- DNS cutover for `jamiekendrioski.com`
- Add `admin.jamiekendrioski.com` subdomain
- Verify subdomain middleware works in prod

---

## 8. Painting detail UX (the key upgrade)

The single biggest pain point on the current site. Spec:

**Route:** `/portfolio/[section]/[slug]`

**Layout:**
- Above the fold: full painting image, `object-contain`, max-h-[80vh] — never cropped
- Side panel (desktop) or below (mobile):
  - Title (Fraunces, large)
  - Year • Medium • Dimensions (eyebrow row)
  - Price OR status badge ("Sold" / "Not for sale" / "Available — $X,XXX")
  - "Inquire about this piece" button
  - Story (prose body, markdown-rendered)
- Additional images carousel (from `painting_images` table)
- "Other work in [Section]" — 4 thumbnails, randomized from same section
- OG metadata: image = primary_image_url, title, description = story excerpt

**Inquire button:**
- Opens a dialog (shadcn Dialog)
- Fields: name, email, message (pre-filled with "I'm interested in [Painting Title]")
- Submits to `/api/inquiries` → inserts into `inquiries` table → emails Jamie via Resend
- Success state: "Jamie will be in touch soon."

**Section grid lightbox:**
- Still exists for quick browsing
- Click image → modal with full painting + minimal metadata
- Esc to close, arrow keys to navigate, deep-link button → opens `/portfolio/[section]/[slug]`

---

## 9. Environment variables

`.env.local` (never committed):
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...   ← was ANON_KEY (deprecated 2026)
SUPABASE_SECRET_KEY=sb_secret_...                         ← was SERVICE_ROLE_KEY (deprecated 2026)
RESEND_API_KEY=
RESEND_FROM_EMAIL=hello@jamiekendrioski.com
NEXT_PUBLIC_SITE_URL=http://localhost:7847
```

Key naming note (Supabase mid-2025 migration):
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` replaces `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SECRET_KEY` replaces `SUPABASE_SERVICE_ROLE_KEY`
- Same privilege levels, same RLS behavior — only the name changed.

Production (set in Vercel dashboard, same keys, different values):
```
NEXT_PUBLIC_SITE_URL=https://jamiekendrioski.com
```

---

## 10. Claude Code prompt template (use at start of each phase)

Paste into Claude Code on Mac Mini when starting a new phase:

```
I'm building Jamie Kendrioski's art portfolio at /Users/bb/projects/jamie-art.

Read /Users/bb/projects/jamie-art/docs/BUILD_SPEC.md before doing anything —
it's the single source of truth for the project.

We're working on Phase [N]: [phase name].

Tasks for this session:
1. [first task]
2. [second task]
3. [third task]

Follow the design tokens, file structure, and conventions in BUILD_SPEC.md
exactly. Use Plan Mode first — show me the file changes before executing.
```

---

## 11. Decisions log

| Date       | Decision | Rationale |
|------------|----------|-----------|
| 2026-06-08 | Next.js + Supabase + Vercel stack | Matches existing project skill, Supabase for auth + storage + DB in one |
| 2026-06-08 | Single Next.js app, admin via path locally, subdomain in prod | Simpler than two apps; one deploy, one env, one repo |
| 2026-06-08 | Local port 7847 | Avoids 3000/4173/4800 used by other projects |
| 2026-06-08 | Painting detail = dedicated route | SEO + shareable URLs vs lightbox-only |
| 2026-06-08 | Fraunces + Inter typography | Editorial weight, both variable, both free via Google Fonts |
| 2026-06-08 | Warm off-white / deep ink, not pure white/black | Jamie's saturated palette needs a neutral that doesn't fight it |
| 2026-06-08 | Magic-link auth (no passwords) | One less thing for Jamie to lose |
| 2026-06-09 | Next.js 16 renamed middleware.ts → proxy.ts, export fn must be `proxy` | Framework requirement — not middleware.ts |
| 2026-06-09 | `(authed)` route group for sidebar pages | Keeps login standalone (no sidebar); route group is URL-transparent |
| 2026-06-10 | Dev-mode RLS escape hatch via `isAuthBypassed()` | `ADMIN_AUTH_BYPASS=true` makes server actions call `createAdminClient()` (secret key, bypasses RLS) instead of `createServerClient()` (publishable key, RLS enforced). Never set on Vercel. |
| 2026-06-10 | Image uploads via `/api/admin/upload` server route | Browser can't use `createAdminClient()`. Route handler uses secret key for storage upload; `getUser()` (not `requireUser()`) for auth gate to return 401 not 308. |
| 2026-06-10 | Theme toggle: CSS `dark:hidden`/`dark:block` for icon switching | Avoids `useState`/`useEffect` mounted guard pattern that triggers `react-hooks/set-state-in-effect` lint error. CSS dark-mode utilities respond to the `dark` class set by `next-themes` on `<html>`. |
| 2026-06-10 | `async function db()` helper per action file | Centralises the bypass check: `isAuthBypassed() ? createAdminClient() : await createServerClient()`. Single import pattern, no repetition per query. |
| 2026-06-10 | `db()` helper also needed in `lib/db/queries.ts` | Phase 4.5 applied the bypass to action files (writes) but missed query helpers (reads). `contacts` and `inquiries` have "auth only" RLS — queries returned `[]` under bypass until Phase 4.6 applied the same `db()` pattern to 7 query functions. |
| 2026-06-10 | Use `<Link className={buttonVariants()}>` not `<Button render={<Link>}>` | Base UI emits a `nativeButton` console warning when `ButtonPrimitive` renders as an anchor via render prop. Plain `<Link>` with `buttonVariants()` class is the correct pattern — already used in nav links. |
| 2026-06-09 | `updateSession` returns `{ response, user }` | Avoids second getUser() network call in proxy; user surfaced from the same auth refresh call |
| 2026-06-10 | Phase 6A layout-preview serves samples via build-time copy to `public/layout-samples/` | `scripts/sync-layout-samples.mjs` (wired as `predev`/`prebuild`) copies `sample_images/*` with slugified filenames. Chosen over a request-time fs route handler: files in `public/` get full `next/image` optimization, whereas an `/admin/*` route handler breaks the optimizer (its internal fetch carries no auth cookie). The page still reads the directory at request time, so the image count is never hardcoded. Both dirs gitignored (~13MB stays out of history). Temporary — delete with `/admin/layout-preview`. |
| 2026-06-10 | Intrinsic image dimensions via `sharp` (transitive Next.js dep) | Already in `node_modules` v0.34.5 — no new dependency. Read at request time in `lib/layout-samples.ts`. |
| 2026-06-10 | Justified-rows algorithm ported inline (Flickr-style greedy row packing) | ~40 lines in `components/layouts/justified-rows.tsx`; no npm dep needed. |
| 2026-06-10 | Layout-preview lightbox inlined, not reused from `painting-lightbox` | `painting-lightbox.tsx` is hard-wired to `Painting` records (status, price, detail links). The dev tool inlines a minimal `SampleLightbox` with the same interaction model (esc / arrows / backdrop). |
| 2026-06-10 | All image corner radius removed globally — full-image rule | No `rounded-*` on any `<img>`, `<Image>`, or direct image-clipping container anywhere in the app (public + admin). Image-only cards (painting-card, section-card) go fully square. Non-image UI (buttons, badges, dialogs, dropzone borders, admin list item cards) keeps its radius unchanged. |
| 2026-06-10 | Justified Rows chosen for `/portfolio/[section]` | Decision from layout-preview comparison. `JustifiedRows` refactored to a generic render-prop component; row heights 320/240/180px (desktop/tablet/mobile). Paintings default to 4/3 aspect ratio (no intrinsic dimensions in DB); can be improved by adding `width_px`/`height_px` columns later. |
| 2026-06-10 | Lightbox killed on real portfolio (Phase 6B item pulled forward) | `SectionGallery` no longer mounts `PaintingLightbox`. Painting tile click → `router.push` via `<Link>` to `/portfolio/[section]/[slug]`. The `PaintingLightbox` component is kept (used nowhere currently) and can be deleted in a future cleanup pass. |
| 2026-06-10 | Phase 6B-C: settings table is single source of truth for phone, email, Instagram, newsletter from-name | `/admin/settings` page reads/writes the single-row `settings` table. `Footer` converted from `"use client"` to async server component so it can call `getSettings()` directly; inline newsletter form replaced with the existing `<NewsletterForm>` client component. Contact page and InquireDialog have no hardcoded contact info (audit clean). |
| 2026-06-10 | Phase 6B-D: Uncategorized is a protected staging section | `deleteSection` action + `delete_section_safe` RPC prevent deletion. Delete button disabled in UI with tooltip. Slug field locked in edit dialog. Server rejects even if UI bypassed. |
| 2026-06-10 | `delete_section_safe` Postgres RPC for atomic move + delete | Moves all paintings from the target section to Uncategorized, then deletes the section in one transaction. `security invoker` so it runs as the authenticated user (who holds RLS all-access). Returns moved count for toast message. |
| 2026-06-10 | Uncategorized hidden from public; listing 404s, painting detail pages remain accessible | `getPublicSections()` filters `.neq('slug', 'uncategorized')`. `/portfolio/uncategorized` returns 404 via early `notFound()` in `[section]/page.tsx`. Individual painting detail pages at `/portfolio/uncategorized/[slug]` remain accessible — no guard in `[section]/[slug]/page.tsx`. |
| 2026-06-10 | Phase 6B-A: Tags use public-read RLS for autocomplete via `/api/tags`; writes use `db()` bypass | `tags` and `painting_tags` have public read so `/api/tags?q=...` needs no auth. Writes in `lib/actions/tags.ts` use the `db()` admin-bypass pattern. Related paintings: tag-based JS-side count+shuffle, section fallback fills the remainder. `getRelatedPaintings` now returns `{ paintings, source }` to drive "Related work" vs "More from [Section]" heading copy. |
| 2026-06-10 | Phase 6B-B: `print_available` / `commission_available` admin toggles use Checkbox (no Switch installed) | Two checkboxes appended to the painting edit form below Tags. Boolean fields flow through `PaintingWriteSchema` → `updatePainting` via `...rest` spread — no action change needed. |
| 2026-06-10 | Phase 6B-B: PrintRequestDialog deep links constructed client-side; settings fetched server-side and passed as prop | Settings (phone + email) fetched once in the painting detail server page and passed down to the client `PaintingDetailView`. No secondary client fetch. WhatsApp URL strips all non-digits from the E.164 phone number. |
| 2026-06-10 | Phase 6B-B: `submitCommissionInquiry` uses `createAdminClient()` directly | Commission form is public (no auth). `createAdminClient()` bypasses RLS — avoids relying on a public insert policy that may not be defined. Consistent with how other public-facing inserts work. |
| 2026-06-10 | Phase 6B-B: `lib/form-prefill.ts` shared localStorage util | Single key `jamie-art:form-data`, guards `typeof window === "undefined"` for SSR. Saves name/email/phone on successful commission submit; never saves message or painting reference. |
| 2026-06-11 | Phase 6C-2: Bulk upload uses a single `bulkCreatePaintings` server action (not per-card `createPainting` calls) | One round-trip from client to server; action handles slug deduplication (against DB + within batch), sort_order assignment, and tag upserts. Simpler than parallel per-card calls and avoids partial-save race conditions. |
| 2026-06-11 | Phase 6C-2: Details dialog uses a `DetailsForm` sub-component mounted with `key={card.id}` | Resets local form state cleanly when a different card's dialog opens without `useEffect` syncing. Parent state is only updated once on close — no per-keystroke re-renders of the 30-card grid. |
| 2026-06-11 | Phase 6C-2: Upload concurrency via queue ref + active-count ref, not `useEffect` | Queue drain is triggered synchronously after file selection and after each upload completes. Avoids the extra render cycle that a `useEffect`-watcher would add, and doesn't require `cards` in scope (uses stable setter pattern). |
| 2026-06-11 | Phase 6C-2: Folder pick via hidden `<input webkitdirectory>` alongside react-dropzone | react-dropzone v15 does not expose `webkitdirectory` on its managed input. A separate hidden input with `webkitdirectory` handles the "pick folder" button; the drop-zone input handles drag-drop and normal multi-select. |
| 2026-06-11 | Phase 6C-2: `/api/admin/delete-upload` POST endpoint for storage cleanup | Mirrors the upload route pattern — auth-gated, bucket allowlist, admin client for storage. Used by × remove and Cancel to clean up blobs that were uploaded but not yet saved to the DB. |
| 2026-06-11 | Phase 6C-4: Hero redesigned to 60/40 editorial grid; featured painting = latest available from abstracts section (any available fallback); `HeroSection` kept `"use client"` and receives `painting` + `bioTeaser` as props from the server page | Eliminates ~70% above-fold whitespace; painting data fetched server-side in `Promise.all`; client component boundary preserved for Framer Motion hooks. |
| 2026-06-11 | Phase 6C-3: Toaster `position="top-right"` on public layout; CSS media override at ≤639px centres it on mobile. Event card `rounded-2xl` removed. Footer gains Events nav link; mail icon converted from disabled span to `<Link href="/contact">`; bottom nav uses `flex-wrap` + newsletter form uses `w-full` to prevent 375px overflow. `aria-current="page"` added to active NavLinks. Commission form migrated from `useState`+HTML5 to RHF+Zod with `text-xs text-destructive` inline errors. New `ImageWithSkeleton` client component (`bg-muted animate-pulse` skeleton, fades on `onLoad`) applied to JustifiedRows painting tiles and section cover cards. | QA polish sprint — 9 fixes from production smoke test. |
| 2026-06-11 | Phase 6C-5: Theme toggle is a single icon button; CSS `dark:hidden`/`dark:block` swap pattern removes the dropdown entirely | Dropdown (Light / Dark / System) replaced by single toggle; no `useState`/`useEffect` needed — CSS responds to the `dark` class set by `next-themes`. See §11 2026-06-10 decision for the lint-error rationale. |
| 2026-06-11 | Phase 6C-5: Event link URL normalisation in `EventWriteSchema.link` Zod transform | `z.string().transform()` prepends `https://` if the value is non-null/empty and doesn't already start with `http://` or `https://`. Render-side guard in `event-card.tsx` (`normalizeUrl`) is a belt-and-suspenders catch for already-stored bare URLs. |
| 2026-06-11 | Phase 6C-5: Painting detail image uses `width={0} height={0} style={{ width:'auto', height:'auto' }}` Next.js Image pattern | Eliminates fixed `aspect-[4/3]` container that caused gray gutters for non-4:3 paintings. Container becomes `flex items-start justify-center`; image bounds via `max-h-[70vh] md:max-h-[80vh] max-w-full`. No intrinsic pixel dimensions needed in the DB. |
| 2026-06-11 | Phase 6C-5: `ZoomOverlay` component — `fill`-based Image inside a `95vw × 95vh` positioned div | Single-image zoom only; no navigation. Body scroll locked via `document.body.style.overflow = 'hidden'` in a `useEffect` (clean up on return). Esc closes via `keydown` listener. Clicking backdrop closes; click on image itself is stopped from propagating. |
| 2026-06-11 | Phase 6C-5: PWA manifest + icons generated by `scripts/generate-pwa-icons.mjs` using `sharp` (transitive Next.js dep) | Outputs `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` to `public/`. SVG source is an inline string (no separate file); `JK` monogram on `#FAFAF7` background. `app/layout.tsx` adds `manifest` + `appleWebApp` metadata fields. |
| 2026-06-11 | Phase 6C-6: `react-easy-crop` for the admin image crop UI | MIT, ~25kb gz, ships pinch-to-zoom and touch pan out of the box. No in-repo alternative — `react-dropzone` only handles file selection, not crop rendering. Crop output is JPEG 0.9, max 2000px on the long side (downscaled during canvas draw). |
| 2026-06-11 | Phase 6C-6: Three new settings columns for managed images; `ImageCropUploader` owns the server action call via a `field` prop | Avoids the server-action-as-prop problem (can't pass server actions from server components to client components as arbitrary callbacks). `updateSettingImage(field, url\|null)` is called inside the client component directly. Whitelist + Zod `url().nullable()` validation on the server. |
| 2026-06-11 | Phase 6C-6: `site-images` bucket for home hero + commission hero; `headshots` bucket reused for about profile photo | `headshots` was always intended for the About page photo. `site-images` is a new public-read / auth-write bucket for non-portrait images. |
| 2026-06-11 | Phase 6C-6: About page hides headshot column entirely when `settings.about_image_url` is null | No broken placeholder. Bio text spans `lg:col-span-2` when no image is set so the layout doesn't leave an empty left column. |
| 2026-06-11 | Phase 6C-6: Home hero fallback chain: settings image → latest available abstract → any available painting → muted placeholder | Settings image wins when set; painting fallback preserves existing Phase 6C-4 behaviour. Alt text is "Jamie Kendrioski" for settings image, painting title for painting fallback. |
| 2026-06-11 | Phase 6D-2: `settings.featured_painting_id` adds a second tier to the hero fallback chain | Priority: custom upload (`home_hero_image_url`) > specific pinned painting (`featured_painting_id`) > latest available abstract. Resolution happens in `app/(public)/page.tsx` server component — if `featured_painting_id` is set, `getPaintingById` is called; otherwise `getFeaturedPainting()`. Admin picker is a custom inline combobox (no cmdk/Radix Popover dependency) in `components/admin/painting-picker.tsx`. |
| 2026-06-11 | Phase 6D-2: Mobile nav redesigned as branded slide-out drawer with wordmark, eyebrow, theme toggle, and social icons | `SheetContent` width changed to `w-[80vw] max-w-[340px]`. Full-height flex column: header (wordmark + "PAINTER · BOSTON"), flex-1 nav links (text-2xl serif, generous py-3), sticky footer (ThemeToggle + social icons, bg-muted/30). ThemeToggle removed from the mobile header bar and moved into the drawer footer. `SheetOverlay` backdrop changed from `bg-black/10` to `bg-black/50` to fully dim the page. Settings (instagram_handle, email) fetched in `(public)/layout.tsx` and passed as `navSettings` prop to `<Nav>`. |
| 2026-06-11 | Phase 6D-1: `resend` SDK added for newsletter sends | Official Resend Node.js SDK (MIT). Only supported, typed way to call the Resend email API. |
| 2026-06-11 | Phase 6D-1: `marked` added for email HTML generation | `react-markdown` (already in deps) renders React nodes — unusable for generating HTML strings needed in email templates. `marked.parse()` is synchronous, works in both Node and browser (preview pane in admin UI). |
| 2026-06-11 | Phase 6D-1: Sending domain is `onboarding@resend.dev` (Resend sandbox) until DNS cutover | **ACTION REQUIRED at DNS cutover:** update `RESEND_FROM_EMAIL` env var to `jamie@jamiekendrioski.com` in both `.env.local` and Vercel dashboard. |
| 2026-06-11 | Phase 6D-1: 100-recipient free-tier guard fires before any sends | Resend free plan: 100 emails/day. Guard checks `count(subscribed=true)` before inserting the newsletter row or sending anything. Returns a clear error message with instructions to upgrade. |
| 2026-06-11 | Phase 6D-1: Sequential sends, no artificial delay | Under 100 recipients, sequential `await resend.emails.send()` calls stay within Resend's 2/sec rate limit naturally. No `setTimeout` needed. |
| 2026-06-11 | Phase 6D-1: `createAdminClient()` used for the public `/unsubscribe` page token lookup | The page is unauthenticated; using the admin client (secret key, bypasses RLS) for a single `SELECT … WHERE unsubscribe_token = ?` query. No broad public-read RLS change on the contacts table. |
