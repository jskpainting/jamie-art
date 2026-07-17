# HANDOFF — current state & next task

> Read this first, then `docs/BUILD_SPEC.md` and `CLAUDE.md`. This file is the
> live continuation point. A new chat can start from here by saying "continue".

_Last updated: 2026-07-17 (session end)._

---

## TL;DR status

- The site **runs locally only** (`npm run dev` → http://localhost:7847). It has **never been deployed to Vercel** and the public domain `jamiekendrioski.com` still serves the **old Square/Weebly site**. Do not tell the user it's "published" — it isn't.
- All work is **committed to `main`** and (as of session end) **pushed to GitHub** (`jskpainting/jamie-art`). `.env.local`, `.next/`, and `migration-data/images/` (165 MB) are gitignored.
- The build is green: `npm run build && npm run lint` both pass.

## What exists now (done)

1. **84 real paintings imported** into Supabase (Postgres + Storage), scraped from the live Weebly site. Counts: abstracts 50, cityscapes-seascapes 14, florals 8, pixels-rainbows 12. Full-res images live in the `paintings` Storage bucket; DB rows carry title/year/medium/dimensions/price/status + real pixel `width`/`height`. Import artifacts: `migration-data/` (`import.mjs`, `master.json`, `master.csv`; the 165 MB `images/` is gitignored).
2. **Portfolio gallery layout = "two per row"** (the user's chosen layout, approved after several iterations):
   - `lib/pairs-layout.ts` — pure framework. **Always 2 per row** (1 on mobile). Size driven by **physical HEIGHT** (height is the priority signal), width from true aspect → **full image, never cropped**. Overflowing pairs scale down uniformly; rows baseline-aligned.
   - `components/pairs-gallery.tsx` — the live gallery (measures width, renders pairs, CSS-columns fallback for SSR/no-JS). Used by `app/(public)/portfolio/[section]/page.tsx`.
   - Tiles have a subtle all-around shadow + hairline ring; captions are **bold serif title + year**, then `dims · price/status`. Legend "Shown to relative scale".
3. **Painting detail page redesigned** — `components/painting-detail-view.tsx` (large uncropped art, sticky placard, spec list, prominent Inquire, print/commission, keyboard-accessible zoom). Related works upgraded to `next/image` links. Inquiry copy is pronoun-neutral.
4. **Admin section cover-image picker** — `components/admin/cover-image-picker.tsx` + `lib/actions/covers.ts`: pick any painting in a section as its cover and crop it 4:3, or upload. Wired into `components/admin/section-form-dialog.tsx`.
5. **Layout Preview tool** rebuilt (`app/admin/(authed)/layout-preview/`) — compares 3 layouts (Two-per-row / Mosaic / Columns) on the real Abstracts paintings. Shared math in `lib/pairs-layout.ts` + `lib/mosaic-layout.ts`.

## Must-fix BEFORE any public deploy / domain cutover

- 🔴 **Admin has no identity lock.** `lib/supabase/auth.ts` only checks that *a* user exists, and the magic-link form allows self-signup (`shouldCreateUser` not disabled). Once public, anyone could sign in with their own email and get full admin. **Add an admin-email allowlist (env `ADMIN_EMAILS`) checked in `getUser()`/`requireUser()`, and set `shouldCreateUser:false`.** Needs the user's admin email.
- Also pending for launch: `RESEND_FROM_EMAIL` is still `onboarding@resend.dev` (verify domain in Resend); the `admin.jamiekendrioski.com` subdomain rewrite is not implemented in `proxy.ts`; open-redirect guard in `app/auth/callback/route.ts` (`next=//evil.com`); newsletter re-subscribe on `app/api/newsletter/route.ts`; SEO `sitemap.ts`/`robots.ts` missing.

## Deploy reality

Not deployed. To go live the user must: un-pause/keep Supabase running, connect **his** Vercel account to the GitHub repo, set env vars in Vercel (with `ADMIN_AUTH_BYPASS` OFF, real `NEXT_PUBLIC_SITE_URL`), do the **security lock above**, then DNS-cutover `jamiekendrioski.com` off Weebly → Vercel + add `admin.` subdomain. Claude cannot do the Vercel/DNS steps without the user (his accounts).

## NEXT TASK (build this when the user says "continue")

**A comprehensive, interactive image-crop experience for every image upload**, with a **live WYSIWYG preview showing exactly where/how the image will appear in its destination** (about-page headshot frame, home hero banner, event image, painting image, section cover). Requirements from the user:
- Drag-and-drop, easy to use, pan + zoom, "best-in-class" feel.
- Must show the crop **in context** — e.g. cropping the About headshot previews it inside the actual About-page frame; cropping the home hero previews it in the hero banner shape.
- Works across all image fields (headshots, site-images/hero/commission, events, paintings, section covers).
- Consider using **Fable** to design it. Build it so it can be hosted.

What already exists to build on: `components/admin/image-upload-cropper.tsx` (react-easy-crop, aspect or "free", canvas compress → `/api/admin/upload`) and `components/admin/cover-image-picker.tsx` (pick-from-paintings + 4:3 crop). The new feature should generalize/upgrade these into one polished, context-aware cropper. Image fields live in: `app/admin/(authed)/bio/` (headshot), `settings/` (home hero, about image, commission image), `events/`, `portfolio/[section]/painting-form-dialog.tsx`, and the section cover dialog.

## How to run / verify

- `npm run dev` → http://localhost:7847 (port 7847; `predev` runs `scripts/sync-layout-samples.mjs`). Admin is open locally via `ADMIN_AUTH_BYPASS=true` in `.env.local`.
- `npm run build && npm run lint` must pass before committing.

### Gotchas learned this session (avoid repeating)
- **Never `rm -rf .next` while the dev server is running** — it 500s the live server. If you must clean-build, stop the dev server first, or build on a separate checkout.
- Editing a **lib file** (e.g. `lib/pairs-layout.ts`) often does **not** hot-reload in Next dev — restart the dev server to see lib changes.
- Next 16 enforces a **single dev-server instance** (lock); a second `next dev` refuses to start. Dev logs: `.next/dev/logs/next-development.log`.
- The client galleries measure container width via `ResizeObserver` + rAF; if a headless/embedded browser reports `innerWidth: 0`, they render blank — that's an environment issue, not a bug.
