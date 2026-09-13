-- Task: remembered dropdown choices for the Medium and Size fields on the
-- painting form and bulk upload, managed from Admin → Settings.
--
-- Values are normalised before storage so "12" x 12"" and "12"x12"" collapse
-- into one entry: trim, collapse runs of whitespace to one space (dimensions
-- also strips all whitespace and folds × / X to a lowercase x).
--
-- Additive and idempotent — safe to run more than once.

create table if not exists field_options (
  id uuid primary key default gen_random_uuid(),
  field text not null check (field in ('medium', 'dimensions')),
  value text not null,
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (field, value)
);

alter table field_options enable row level security;

drop policy if exists "auth all field_options" on field_options;
create policy "auth all field_options"
  on field_options for all using (auth.role() = 'authenticated');

-- Seed from what's already on the paintings, recency = newest painting using it.
insert into field_options (field, value, last_used_at)
select 'medium', trim(regexp_replace(medium, '\s+', ' ', 'g')), max(created_at)
from paintings
where coalesce(trim(medium), '') <> ''
group by 2
on conflict (field, value) do nothing;

insert into field_options (field, value, last_used_at)
select 'dimensions',
       replace(replace(regexp_replace(trim(dimensions), '\s+', '', 'g'), '×', 'x'), 'X', 'x'),
       max(created_at)
from paintings
where coalesce(trim(dimensions), '') <> ''
group by 2
on conflict (field, value) do nothing;
