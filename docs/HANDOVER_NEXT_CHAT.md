# Handover — how to continue

## Sonnet subagent fan-out is authorised

An earlier version of this file said "no subagents, no fan-out" after a
session that ran ~700 agents with poor coordination. The owner explicitly
re-authorised Sonnet subagent fan-out on 2026-09-13, and it worked well that
session using **disjoint file ownership per agent**, `tsc` + `lint` run
inside each agent, and **one build + one commit done by the lead** after
integrating. Use that pattern again: split work along files that don't
overlap, let each agent verify its own slice, then integrate and verify as a
whole before committing.

Still avoid: open-ended audits/sweeps/reports nobody asked for, large agent
counts for small tasks, and committing before `npm run build && npm run lint`
both pass on the integrated result.

## Where to start

1. Read `docs/HANDOFF.md` first — current state, what shipped, and the open
   "Next steps".
2. Read `docs/ACTION_ITEMS.md` — the things only the owner can do (measuring
   paintings, adding an AI key, verifying the Resend domain, phone testing).
3. If picking up recent feature work, the plan files from the 2026-09-13
   session are still useful references for design decisions and file lists:
   `docs/PLAN_2026-09-13.md`, `docs/PLAN_BULK_UPLOAD.md`, `docs/PLAN_TAGS.md`,
   `docs/PLAN_NEWSLETTER_AI.md`, `docs/PLAN_CRM_EVENTS.md`.
4. `CLAUDE.md` has the standing architecture/conventions and the critical
   "verifying data-layer changes" section — read it before touching
   `lib/db/queries.ts`, `lib/actions/*`, or the schema.

## Non-negotiables (unchanged)

- Deploy = `git push` to `main`. Never use the Vercel CLI from this Mac.
- A green build proves almost nothing — query helpers swallow errors and
  return `[]`. Verify real rendered content on localhost and production after
  any data-layer change (see `CLAUDE.md`).
- Pin every PostgREST embed to its FK; gate the write path, not just the UI;
  migrations are applied by hand by the owner via `docs/RUN_THIS_SQL.md`.
