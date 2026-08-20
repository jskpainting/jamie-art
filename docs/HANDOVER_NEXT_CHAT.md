# Handover — start the next chat with this

Paste this whole file as your first message.

---

## 🔴 READ THIS FIRST — HOW TO WORK

**Do the work yourself, in this chat. Do NOT fan out.**

- **No subagents. No workflows. No parallel agents. No "ultracode".**
  The last session ran ~700 agents. Each one has its own separate memory, they
  cannot see what you know, and coordinating them burned most of the budget on
  overhead. It found real bugs, but the same bugs would have been found faster
  by one person reading the code carefully.
- **Do not invent work.** There is a backlog below. Work through it in order.
  Do not start audits, sweeps, reports, or refactors nobody asked for.
- **Keep it light.** Small changes, verified, committed, pushed. Then stop and
  tell the owner. Do not disappear for an hour.
- **Ask before big moves.** If something looks like it needs more than an hour,
  say so and let the owner decide.

---

## THE PROJECT

jamiekendrioski.com — art portfolio + self-serve admin for a Boston painter.
Next 16 · React 19 · TypeScript · Tailwind v4 · shadcn/ui · Supabase · Vercel.
Repo: GitHub `jskpainting/jamie-art`.

**Deploy = `git push` to `main`** (Vercel auto-deploys in ~40–60s).
**Never use the Vercel CLI from this Mac** — it's signed into the wrong account.

Read `CLAUDE.md` and `docs/HANDOFF.md` before changing anything. They were
corrected on 2026-08-20 and are now accurate.

## CURRENT STATE (verified 2026-08-20, ~04:15 UTC)

- HEAD = `562170c`, working tree **clean**, fully **pushed**, production live.
- `npm run build` and `npm run lint` both pass.
- Live data: **85 paintings** — abstracts 51 · cityscapes-seascapes 14 ·
  florals 8 · pixels-rainbows 12. Also: sections 5 · events 2 · contacts 7 ·
  inquiries 4 · commission_inquiries 3.
- Dev server may still be running on port 7847. Don't kill it repeatedly;
  `lib/*` edits don't hot-reload, so restart **once** after editing those.

## 🔴 NON-NEGOTIABLE RULES

1. **`.env.local` points at the LIVE PRODUCTION database** (`ADMIN_AUTH_BYPASS=true`).
   localhost:7847/admin is an unauthenticated editor on real data. Anything you
   create for testing must be clearly labelled (`ZZ TEST …`), deleted after, and
   the counts above proven restored. **Never trigger a newsletter send.**
2. **A green build proves almost nothing.** Query helpers catch errors and
   return `[]`, so a broken query renders an empty page while build, lint and
   tsc all pass. After ANY change to `lib/db/queries.ts`, `lib/actions/*` or the
   schema, count real rendered content:
   ```bash
   curl -s https://www.jamiekendrioski.com/portfolio/abstracts \
     | grep -oE "/portfolio/[a-z-]+/[a-z0-9-]+\"" | sort -u | wc -l   # expect 51
   ```
3. **Pin every PostgREST embed to its FK** — `sections!paintings_section_id_fkey(...)`.
   A bare embed throws PGRST201, gets swallowed, and empties the site. Two
   outages already.
4. **Gate the WRITE path, not just the UI.** This exact mistake broke painting
   saves on production for hours last session: the admin screen was correctly
   hidden behind a capability check, but the server action still sent the
   unmigrated column, and PostgREST rejects the whole statement.
5. **Migrations are applied by hand by the owner** in the Supabase SQL editor.
   New SQL goes in `supabase/migrations/` + a copy-paste block in
   `docs/RUN_THIS_SQL.md`, gated behind `lib/schema-capabilities.ts`.

## WHAT THE LAST SESSION DID (all shipped and verified)

Six real bugs, each reproduced by hand, fixed, and re-verified against the live
site. Full detail is in the "Session 2026-08-20" section of `docs/HANDOFF.md`.

1. `8ef8431` — **painting create/edit/bulk-upload were broken on production**
   (Zod `.default(true)` injected `story_public`, a column that doesn't exist)
2. `8dcb7ab` — sold paintings (74 of 85) ignored the owner's drag order
3. `8ddc4c1` — event dates differed per time zone; `/events` advertised JPOS a
   day too long; React #418 on every non-UTC load
4. `843aa40` — cancelling an event deleted it from admin permanently
5. `2c91ec7` — editing a contact re-subscribed opt-outs and wiped their tags
6. `3b96792` — a newsletter that delivered to nobody reported "Sent"

Plus `d9638e3` + `9681570`: search/filter/sort on the last three admin lists
(galleries, painting list, show cards) — completing all eight. On drag-reorderable
lists, sorting/filtering is view-only and dragging switches off outside the
owner's own view, with "Back to my order".

**The hydration error the owner reported is NOT a bug** — it's a browser
extension inserting an element into the page. Reproduced and confirmed; both
error strings are stripped from the production build. No fix needed. Don't
re-investigate it.

Report for the owner: https://claude.ai/code/artifact/6785308d-d66f-4504-a57a-49b852c79fff

## 🎯 BACKLOG — do these in order, one at a time

**1. Ask the owner first, before coding anything:**
   - Three paintings have no usable `dimensions` so they have no AR model:
     `globe-2`, `cityscape`, and one `untitled`. Ask for the real height ×
     width. **Do not guess** — a wrongly sized true-scale model is worse than
     none. Then run `node scripts/generate-all-ar-models.mjs`.
   - Five of the seven contacts are leftover QA addresses
     (`test+newsletter@`, `qa-test@`, `ratelimit-test@`, `verify-newcode@`,
     `www-verify@`, all `@example.com`, four marked subscribed). Ask whether to
     delete them.
   - `RESEND_FROM_EMAIL` is unset, so newsletters cannot send. He needs to set
     it to an address on a verified domain in Vercel.

**2. Unverified findings from the last session.** ~388 possible problems were
   raised; only 165 got a second opinion and 32 of those were thrown out as
   false. **Treat the rest as leads, not facts.** The raw list is at
   `/private/tmp/claude-501/-Users-bb-code-jamie-art/e5670d03-d1dd-4276-af41-61a1dae8d85f/scratchpad/qa/findings.json`
   (may be gone if /tmp was cleared — if so, skip it, don't regenerate it).
   Pick the highest-severity ones, **verify each yourself before acting**, and
   fix only what you can prove. Ones that looked most credible:
   - `bulkAddTag` / `bulkRemoveTag` discard write errors then report success
   - `reorderSections` reports "Order saved" even when every write failed
   - settings/bio single-row upserts can create a duplicate row that breaks
     `getSettings()` site-wide
   - dashboard "New inquiries" ignores commission inquiries (3 are invisible)
   - `/api/newsletter` re-subscribes anyone by email, unauthenticated
   - bulk upload doesn't record pixel width/height, so galleries guess 4:3

**3. Public-site sweeps that never finished** — links, SEO/JSON-LD, dark mode,
   keyboard accessibility, page speed, security headers. Do these **yourself**,
   one at a time, only if the owner wants them.

**4. Known and deliberately deprioritised** — `/portfolio/<bogus>` returns HTTP
   200 with the correct "not found" UI. SEO-only, invisible to users. Leave it.

## HOW THE OWNER WORKS

- Non-technical, uses voice-to-text — transcripts are garbled. **Infer intent**,
  ask only when genuinely ambiguous.
- He runs the whole site from `/admin`. "Everything publicly visible must be
  editable from admin" is a standing goal.
- **No jargon in admin UI.** He rejected a section labelled "Site copy". Group
  by page, plain labels, and pre-fill boxes with the current live text.
- He gets justifiably angry about shipped-but-broken UI. Test click-by-click and
  verify real rendered content, not HTTP 200s.
- **Two things only he can test:** AR on a real phone, and the "Send as a text"
  button on a real device. Ask him; never claim they're verified.

## USEFUL TOOLS LEFT BEHIND

Playwright + axe-core are installed **outside the repo** (repo stays clean) at
`/private/tmp/claude-501/-Users-bb-code-jamie-art/e5670d03-d1dd-4276-af41-61a1dae8d85f/scratchpad/qa/`:

- `probe.mjs <url> [--axe] [--viewport=WxH] [--theme=dark]` — console errors,
  page errors, failed requests, axe violations, horizontal overflow
- `interact.mjs <url>` — safely opens every dialog/menu (has a deny-list so it
  never clicks anything destructive), checks Escape closes them
- `breadth.sh <base-url> <routes-file>` — counts real rendered content over many
  routes, flags only failures
- `baseline.sh <label>` — read-only fingerprint of every table; run before and
  after any write test to prove nothing real changed

`/tmp` may have been cleared. If these are gone, **don't rebuild them unless you
actually need them.**
