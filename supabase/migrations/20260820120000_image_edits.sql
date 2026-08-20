-- Task: non-destructive image editing.
--
-- Every edit keeps the untouched original and writes a NEW file (under crops/),
-- so an edited image always gets a fresh URL. That matters because
-- next.config.ts caches image URLs for a year (minimumCacheTTL) — overwriting a
-- file in place would keep serving the old picture for months.
--
-- This table remembers, for each edited file, which original it came from and
-- what was done to it (crop rectangle + brightness/contrast), so re-opening the
-- editor starts from the ORIGINAL (no quality loss from repeated edits) and
-- "Revert to original" is always possible.
--
-- Additive and idempotent — safe to run more than once.

create table if not exists image_edits (
  id            uuid primary key default gen_random_uuid(),
  bucket        text not null,
  path          text not null,          -- the edited file (crops/….jpg)
  source_bucket text not null,
  source_path   text not null,          -- the untouched original
  recipe        jsonb not null default '{}',
  created_at    timestamptz default now(),
  unique (bucket, path)
);

alter table image_edits enable row level security;

-- Admin-only: there is nothing public about edit recipes.
drop policy if exists "auth all image_edits" on image_edits;
create policy "auth all image_edits"
  on image_edits for all using (auth.role() = 'authenticated');
