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
  created_at timestamptz default now()
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
- `headshots` — public read, authenticated write
- `events` — public read, authenticated write

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
