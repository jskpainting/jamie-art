-- Task: AI-assisted painting stories + per-painting story visibility.
--
-- `story_public` controls whether a painting's story is shown on the public
-- detail page. Defaults to TRUE so every existing story keeps showing exactly
-- as it does today; the owner can hide one without deleting it.
--
-- `story_notes` holds the owner's raw thoughts/keywords that the AI turns into
-- the story. Never rendered publicly — it exists so the notes survive a reload
-- and can be re-run through the generator later.
--
-- Additive and idempotent — safe to run more than once.

alter table paintings add column if not exists story_public boolean not null default true;
alter table paintings add column if not exists story_notes text;
