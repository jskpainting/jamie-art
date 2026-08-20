ultracode

You are taking over a live production website mid-project. Read `docs/HANDOFF.md`,
`CLAUDE.md`, and `docs/BUILD_SPEC.md` in /Users/bb/code/jamie-art FIRST.

I have ~3 hours of Max-plan budget to burn deliberately. GO ALL IN: fan out
aggressively with parallel agents, use Opus for reasoning/planning/judging and
Sonnet for mechanical execution, and verify adversarially. NO compromise on
quality — more agents should mean more verification, not more sloppiness.
Do not do the work in your own context: orchestrate, delegate, and keep your
context for decisions and final verification.

## THE PROJECT
jamiekendrioski.com — an art portfolio + self-serve admin for a Boston painter.
Next.js 15 App Router · TypeScript · Tailwind v4 · shadcn/ui · Supabase
(Postgres/Auth/Storage) · Vercel. Repo: GitHub `jskpainting/jamie-art`.

**Deploy = `git push` to `main`** (Vercel auto-deploys in ~40-60s). NEVER use the
Vercel CLI from this Mac — it is signed into the wrong account.

## CURRENT STATE (verified just now)
- HEAD = `c464af3`, working tree CLEAN, `npm run build` and `npm run lint` PASS.
- ⚠️ **The last 2 commits are NOT pushed.** Production is still running `a968e49`.
  Everything below that says "built" is committed locally but NOT live yet.
- Live data: **85 paintings** — abstracts 51 · cityscapes-seascapes 14 ·
  florals 8 · pixels-rainbows 12. Use these as an integrity check after ANY
  data-layer change.

## 🔴 NON-NEGOTIABLE RULES
1. **This is the owner's LIVE production database and storage.** Real paintings,
   real contacts, real inquiries, real photos. Do NOT delete or modify real
   records. Anything created for testing must be removed and the counts above
   proven restored. NEVER trigger a newsletter send.
2. **A green build proves almost nothing here.** Every query helper catches its
   errors and returns `[]`, so a broken query renders an EMPTY PAGE while build,
   lint and tsc all pass. After ANY change to `lib/db/queries.ts`,
   `lib/actions/*`, or the schema, verify by counting real rendered content:
   ```bash
   curl -s https://www.jamiekendrioski.com/portfolio/abstracts \
     | grep -oE "/portfolio/[a-z-]+/[a-z0-9-]+\"" | sort -u | wc -l   # expect 51
   curl -s https://www.jamiekendrioski.com/portfolio | grep -c "Collections coming soon"  # expect 0
   ```
3. **PostgREST embeds must be pinned to their FK.** The `painting_sections` join
   table created a second paintings↔sections relationship, so a bare
   `sections(...)` or `paintings(...)` embed throws PGRST201, gets swallowed by
   `catch → return []`, and silently empties pages. This caused TWO production
   outages. Always write `sections!paintings_section_id_fkey(...)` /
   `paintings!paintings_section_id_fkey(...)`, and grep every `.select(` touching
   those tables before shipping.
4. **Concurrent agents MUST have disjoint file ownership.** In this project two
   agents editing `lib/db/queries.ts` wiped a function and later duplicated it;
   another ran `git stash` in the shared tree and nearly lost 40+ files of work.
   Give every agent an explicit "FILES YOU OWN" and "DO NOT TOUCH" list. **Forbid
   `git stash` and `git commit` in subagents** — you do the committing.
5. **Migrations are applied BY HAND by the owner** in the Supabase SQL editor.
   New columns go in `supabase/migrations/`, a copy-paste block goes in
   `docs/RUN_THIS_SQL.md`, and the UI is gated behind `lib/schema-capabilities.ts`
   so nothing errors before it runs.
6. The sandbox browser is flaky (`Viewport: 0x0`, hung panes). Open a fresh tab;
   prefer `read_page`/`get_page_text`/`javascript_tool` for assertions and
   screenshots only to judge looks.

## ⏳ SQL ROUNDS 2, 3 AND 4 ARE UNRUN ON PRODUCTION
Verified: `webauthn_credentials`, `image_edits`, `settings.commission_heading`,
`settings.inquiry_sms_enabled`, `paintings.story_public` all DO NOT EXIST yet.
So passkeys, AI stories, quick-inquire settings and image editing are correctly
HIDDEN behind capability gates. **Do not report that as a bug.** The blocks are
in `docs/RUN_THIS_SQL.md` for the owner to run.

## WHAT IS ALREADY BUILT (committed, unpushed, needs final verification)
Printable QR "Show cards" + print sheet (10-up, Letter/A4, cut ticks,
calibration ruler) · scan→AR arrival (`?ar=1`) · quick inquire (SMS or website,
editable template) · AI story writer + private stories + a free multi-provider
model router · centralized image presets + shared editor + non-destructive
re-editing + brightness/contrast · media-library editing with "use everywhere" ·
ONE freely-draggable admin painting list (sold included) · wall-fit preview +
"Match painting shape" nudge · passkey availability gating + post-login "set up
Face ID" offer · mobile overflow fixes · filter/sort toolbar on 5 admin lists.

## 🎯 WHAT REMAINS — THIS IS YOUR JOB
1. **Filter + sort on the last 3 lists** (a shared `components/admin/list-toolbar.tsx`
   already exists — reuse it): `app/admin/(authed)/portfolio/sections-client.tsx`,
   `app/admin/(authed)/portfolio/[section]/painting-list-client.tsx`, and
   `app/admin/(authed)/show-cards/show-cards-client.tsx`.
   ⚠️ The painting list is DRAG-REORDERABLE. Sorting must be VIEW-ONLY: while a
   sort is active, disable dragging and show a clear "Back to my order" control.
   Never persist a sort to `sort_order`. Bulk selection exists there — if a
   filter hides selected rows, surface "3 selected (1 hidden by filter)".
2. **Fix the site-wide hydration error** — "Hydration failed… Encountered a script
   tag" appears on `/admin` AND `/admin/show-cards`, so it is NOT from the
   show-cards work. Suspects: the inline theme script in `app/layout.tsx` or
   `components/json-ld.tsx`'s `dangerouslySetInnerHTML`. Diagnose properly.
3. **Cancelled events are unreachable** — `getCurrentEvents`/`getUpcomingEvents`/
   `getPastEvents` in `lib/db/queries.ts` never fetch `status='cancelled'`, so the
   admin's Cancelled filter always shows 0 and cancelled events vanish entirely.
   Decide + implement the right behaviour (likely: show them in admin, keep them
   off the public site).
4. **3 paintings have no AR model** because their `dimensions` are blank/unparseable
   (`globe-2`, `cityscape`, one `untitled`). Everything else has one (82/85).
   `node scripts/generate-all-ar-models.mjs` regenerates; it skips paintings
   without parseable dimensions. Surface this to the owner rather than guessing sizes.
5. **FULL adversarial QA round** — this is where the budget should go. Every admin
   page and every public page, desktop + tablet + mobile, light + dark, every
   button/dialog/drag/form, back-and-forth navigation, plus security. Fan out
   hard, verify findings adversarially (multiple independent agents must agree a
   bug is real before you act), then fix and re-verify.
6. **Then push everything** and confirm live with real content counts, not 200s.

## HOW THE OWNER WORKS (important)
- Non-technical, communicates by voice-to-text — transcripts are garbled, INFER
  INTENT and ask only when genuinely ambiguous.
- He wants to run the whole site himself from `/admin`. "Everything publicly
  visible must be editable from admin" is a standing goal.
- **No jargon in admin UI.** He rejected a section literally labelled "Site copy".
  Group by page, use plain labels, and PRE-FILL text boxes with the current live
  text so he can read and edit it rather than facing a blank field.
- He gets (justifiably) angry about shipped-but-broken UI. Test click-by-click and
  verify real rendered content.
- Two things only HE can test: **AR on a real phone** and the **"Send as a text"
  button on a real device**. Ask him; don't claim they're verified.

## REALITY CHECK ON SCALE (be honest with him about this)
The Workflow tool caps **concurrent** agents at `min(16, CPUs-2)` = **8 on this
machine**, with a 1000-agent lifetime cap per workflow and 4096 items per
parallel()/pipeline() call. So "100,000 agents" is not achievable. What IS:
several large workflows run in SEQUENCE, each queueing hundreds of agents through
that 8-wide pipe, with adversarial multi-judge verification (which legitimately
multiplies agent count). Realistically ~300-700 agents over 3 hours. Plan for
depth of verification, not a vanity agent count — and tell him the real number.

Start by reading the docs above and `git log --oneline -8`, then show me your
plan before you start burning agents.
