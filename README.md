# jamiekendrioski.com — Jamie Kendrioski art portfolio

Live site: **https://www.jamiekendrioski.com** · Admin: **/admin** (magic-link, allowlisted)

An editorial portfolio + self-serve admin for a Boston painter. Next.js 15 (App
Router) · TypeScript · Tailwind v4 · shadcn/ui · Supabase (Postgres, Auth,
Storage) · Resend · Vercel.

---

## Quick start

```bash
npm install
cp .env.local.example .env.local   # then fill in the values (see below)
npm run dev                        # http://localhost:7847
```

```bash
npm run build && npm run lint      # both must pass before any commit
```

### Environment (`.env.local`, never committed)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
RESEND_API_KEY=
RESEND_FROM_EMAIL=
NEXT_PUBLIC_SITE_URL=https://www.jamiekendrioski.com
ADMIN_EMAILS=a@example.com,b@example.com   # allowlist — who may sign in
ADMIN_AUTH_BYPASS=true                      # DEV ONLY. Never set on Vercel.
```

`ADMIN_AUTH_BYPASS=true` skips auth locally and substitutes a fake dev user, so
`/admin` works without magic links.

---

## Where things live

```
app/(public)/          public site (home, portfolio, about, events, commission, contact)
app/admin/(authed)/    admin panel — gated by requireUser() in the layout
lib/actions/*.ts       ALL DB writes (server actions, Zod-validated)
lib/db/queries.ts      ALL DB reads
lib/types.ts           mirrors the DB schema exactly — keep in sync
supabase/migrations/   SQL migrations (run by hand in the Supabase SQL editor)
docs/BUILD_SPEC.md     single source of truth: tokens, schema, conventions
docs/HANDOFF.md        current state + what's next  ← start here
docs/RUN_THIS_SQL.md   owner-facing one-time SQL setup
docs/DEPLOY.md         plain-English deploy + admin guide for the owner
```

## Deploying

**`git push` to `main` is the deploy** — Vercel auto-builds and publishes to
`www.jamiekendrioski.com` in ~40–60s. Do **not** use the Vercel CLI from this
machine (it's authenticated to a different account than the live project).

Verify a deploy landed by checking real content, not just a 200:

```bash
curl -s https://www.jamiekendrioski.com/portfolio/abstracts \
  | grep -oE "/portfolio/[a-z-]+/[a-z0-9-]+\"" | sort -u | wc -l   # expect 50
```

## Database migrations

Additive SQL, applied by the owner in the Supabase SQL editor (there is no
migration runner). Every feature that needs new columns is gated behind
`lib/schema-capabilities.ts`, so the app renders fine before its migration runs
and the new UI appears automatically afterwards.

> ⚠️ **Adding a join table can silently break existing queries.** Introducing a
> second FK path between two tables makes implicit PostgREST embeds ambiguous
> (`PGRST201`); the failures are swallowed by `catch → return []`, so pages go
> *empty* with a green build. Pin embeds explicitly, e.g.
> `sections!paintings_section_id_fkey(...)`. See `docs/HANDOFF.md`.

## Conventions

- Reads → `lib/db/queries.ts`; writes → `lib/actions/*.ts` (`"use server"`),
  each gated on `getUser()`, validated with Zod, then `revalidatePath()`.
- Every admin page is a Server Component that passes data to a client form.
- Toasts: `sonner`, always `{ duration: 5000 }`.
- No `rounded-*` on images anywhere (deliberate — see BUILD_SPEC §11).
- `components/admin/image-upload-cropper.tsx` is the one upload component.
