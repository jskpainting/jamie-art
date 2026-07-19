-- Task: "show a painting in more than one gallery".
--
-- A painting still has ONE home gallery (paintings.section_id) which owns its
-- canonical detail URL and slug uniqueness. This join table lists ADDITIONAL
-- galleries the same painting should also appear in — no row duplication.
--
-- Safe/idempotent to run more than once.

create table if not exists painting_sections (
  painting_id uuid not null references paintings(id) on delete cascade,
  section_id  uuid not null references sections(id)  on delete cascade,
  created_at  timestamptz default now(),
  primary key (painting_id, section_id)
);

create index if not exists painting_sections_section_idx
  on painting_sections (section_id);

alter table painting_sections enable row level security;

-- Public can read gallery memberships (needed to render public galleries).
drop policy if exists "public read painting_sections" on painting_sections;
create policy "public read painting_sections"
  on painting_sections for select using (true);

-- Only authenticated admins can change memberships.
drop policy if exists "auth all painting_sections" on painting_sections;
create policy "auth all painting_sections"
  on painting_sections for all using (auth.role() = 'authenticated');
