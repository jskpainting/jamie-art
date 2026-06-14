# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

ALWAYS read `docs/BUILD_SPEC.md` before making changes — it is the single source of truth for design tokens, DB schema, file structure, and conventions.

## Commands

```bash
npm run dev          # starts Next.js on port 7847 (runs sync-layout-samples.mjs first)
npm run build        # production build (also runs prebuild script)
npm run lint         # ESLint check
```

After every phase: `npm run build && npm run lint` must both pass before committing.

## Stack

Next.js 15 App Router · TypeScript · Tailwind v4 · shadcn/ui · Supabase (Postgres + Storage) · Framer Motion · next-themes · Sonner (toasts) · Resend (email) · Zod (validation)

## Architecture

### Route groups
- `app/(public)/` — public site (home, portfolio, about, events, commission, contact)
- `app/admin/(authed)/` — admin panel, gated by `requireUser()` in layout
- `app/admin/auth/` and `app/admin/login/` — magic-link auth flow
- `app/api/admin/` — two upload endpoints: `upload/` and `delete-upload/`

### Auth
`lib/supabase/auth.ts` exports `getUser()` and `requireUser()`. In development, set `ADMIN_AUTH_BYPASS=true` in `.env.local` to skip auth entirely (a fake dev user is substituted). Server actions must call `getUser()` first and return `{ ok: false, error: "Unauthorized" }` if null.

### Data layer
All DB reads/writes go through `lib/actions/*.ts` (Next.js server actions, each file `"use server"`). Pattern: `db()` helper returns an admin client in bypass mode or a cookie-based server client in prod. Actions validate with Zod schemas from `lib/schemas.ts`, mutate, then call `revalidatePath()` on affected routes. Types in `lib/types.ts` mirror the DB schema exactly — do not drift from them.

### Image uploads
`components/admin/image-upload-cropper.tsx` is the single unified upload component used across all admin image fields.
- `aspectRatio="free"` → skips crop dialog, compresses and uploads immediately
- `aspectRatio={number}` → opens react-easy-crop dialog with pan/zoom, then compresses and uploads on save
- Uploads POST to `/api/admin/upload` with `{ file, bucket }` multipart form
- Buckets: `headshots`, `paintings`, `events`, `site-images`
- Deletions POST to `/api/admin/delete-upload` with `{ path, bucket }`
- Client-side compression via Canvas API before upload

### Admin UI conventions
- Every admin page is a Server Component that fetches data and passes it to a `*-form` or client component
- Mutations use server actions (not API routes), called from `"use client"` form components
- `AdminShell` (`components/admin/shell.tsx`) wraps all authed pages; `Toaster` is mounted in the authed layout
- Toast pattern: `toast.success(...)` / `toast.error(...)` from `sonner` — always set `duration: 5000`
- Dialog-close-before-callback rule: in `handleSave`, close dialog and clear state BEFORE calling `onUploadComplete` (server action fires last to avoid RSC refresh interfering with React state)

### Workflow
Plan Mode first → show plan → execute → `npm run build && npm run lint` → commit per phase.

## Recent shipped phases

- 6D-2: Featured painting picker + mobile menu redesign
- 6D-1: Newsletter blast tool with Resend
- 6C-7: Threaded mailto reply for inquiries
- 6C-6: Settings image management with crop UI
- 6C-5: Bug fixes + PWA manifest + zoom overlay
- 6C-4: Editorial side-by-side home hero
- 6C-3: Polish sprint (toaster, validation, skeletons)
- 6C-2: Bulk painting upload tool
- 6C-1: Commission in nav + footer
- 6B-E: Sold sort, home events, bulk actions, mobile audit
- 6B-D: Section CRUD + Uncategorized + orphan banner
- 6B-C: /admin/settings page + dynamic CTAs
- 6B-B: Print/commission CTAs + /commission route
- 6B-A: Tags + related paintings
- 6B.0: Migrations for all 6B feature columns
- 6A.1: Justified rows portfolio + global image radius removal
- 6A: Image layout preview dev tool
