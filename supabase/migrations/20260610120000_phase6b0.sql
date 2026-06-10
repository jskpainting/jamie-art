-- Phase 6B.0: paintings columns, tags, settings, commission_inquiries

-- 1. New columns on paintings
alter table paintings
  add column if not exists width int,
  add column if not exists height int,
  add column if not exists print_available boolean not null default false,
  add column if not exists commission_available boolean not null default false,
  add column if not exists sold_at timestamptz;

-- 2. Backfill sold_at for existing sold paintings
update paintings
  set sold_at = created_at
  where status = 'sold' and sold_at is null;

-- 3. Trigger to maintain sold_at automatically
create or replace function paintings_sold_at_fn()
returns trigger language plpgsql as $$
begin
  if NEW.status = 'sold' and (OLD.status is null or OLD.status <> 'sold') then
    NEW.sold_at := now();
  elsif NEW.status <> 'sold' and OLD.status = 'sold' then
    NEW.sold_at := null;
  end if;
  return NEW;
end;
$$;

drop trigger if exists paintings_sold_at_trigger on paintings;
create trigger paintings_sold_at_trigger
  before update on paintings
  for each row execute function paintings_sold_at_fn();

-- 4. Tags
create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  created_at timestamptz default now(),
  constraint tags_name_lowercase check (name = lower(name)),
  constraint tags_name_length check (char_length(name) between 1 and 50)
);

create table if not exists painting_tags (
  painting_id uuid not null references paintings(id) on delete cascade,
  tag_id      uuid not null references tags(id)     on delete cascade,
  primary key (painting_id, tag_id)
);

create index if not exists painting_tags_tag_id_idx on painting_tags(tag_id);

-- 5. Settings (single-row, like bio)
create table if not exists settings (
  id                   uuid primary key default gen_random_uuid(),
  phone                text,
  email                text,
  instagram_handle     text,
  newsletter_from_name text,
  updated_at           timestamptz default now()
);

insert into settings (phone, email, instagram_handle, newsletter_from_name)
select '+15555555555', 'hello@example.com', 'jamiekendrioski', 'Jamie Kendrioski'
where not exists (select 1 from settings);

-- 6. Commission inquiries
create table if not exists commission_inquiries (
  id                       uuid primary key default gen_random_uuid(),
  from_name                text,
  from_email               text not null,
  from_phone               text,
  message                  text,
  reference_painting_id    uuid references paintings(id) on delete set null,
  reference_painting_title text,
  status                   text not null default 'new'
                             check (status in ('new','replied','closed')),
  created_at               timestamptz default now()
);

-- 7. Uncategorized section seed (idempotent)
insert into sections (slug, title, sort_order)
values ('uncategorized', 'Uncategorized', 999)
on conflict (slug) do nothing;

-- 8. RLS

alter table tags               enable row level security;
alter table painting_tags      enable row level security;
alter table settings           enable row level security;
alter table commission_inquiries enable row level security;

-- tags: public read, auth all
create policy "public read tags"  on tags for select using (true);
create policy "auth all tags"     on tags for all    using (auth.role() = 'authenticated');

-- painting_tags: public read, auth all
create policy "public read painting_tags" on painting_tags for select using (true);
create policy "auth all painting_tags"    on painting_tags for all    using (auth.role() = 'authenticated');

-- settings: public read, auth update only
create policy "public read settings"  on settings for select using (true);
create policy "auth update settings"  on settings for update using (auth.role() = 'authenticated');

-- commission_inquiries: public insert, auth read/update/delete
create policy "public insert commission_inquiries"
  on commission_inquiries for insert with check (true);
create policy "auth read commission_inquiries"
  on commission_inquiries for select using (auth.role() = 'authenticated');
create policy "auth update commission_inquiries"
  on commission_inquiries for update using (auth.role() = 'authenticated');
create policy "auth delete commission_inquiries"
  on commission_inquiries for delete using (auth.role() = 'authenticated');
