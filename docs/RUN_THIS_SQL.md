# One-time database setup

Everything below is **safe to run more than once** and only *adds* things —
it can't delete or change your paintings, events, or text.

## How to run it

1. Go to **supabase.com** → sign in → open the **jamie-art** project
2. Left sidebar → **SQL Editor** → **+ New query**
3. Paste the whole block below
4. Click the green **Run** button (bottom right) — you should see "Success"

That's it. The matching features light up in the admin panel automatically.

## The SQL

```sql
-- 1) FOCAL POINTS — lets you mark the important part of a photo (e.g. a face)
--    so it's never cropped out. 50/50 = centred = exactly how things look now.
alter table settings add column if not exists home_hero_focal_x  real not null default 50;
alter table settings add column if not exists home_hero_focal_y  real not null default 50;
alter table settings add column if not exists commission_focal_x real not null default 50;
alter table settings add column if not exists commission_focal_y real not null default 50;
alter table bio      add column if not exists headshot_focal_x   real not null default 50;
alter table bio      add column if not exists headshot_focal_y   real not null default 50;
alter table sections add column if not exists cover_focal_x      real not null default 50;
alter table sections add column if not exists cover_focal_y      real not null default 50;
alter table events   add column if not exists image_focal_x      real not null default 50;
alter table events   add column if not exists image_focal_y      real not null default 50;

-- 2) GALLERY LAYOUT — lets you switch the portfolio layout from the admin panel.
--    'pairs' is the two-per-row wall you have live today.
alter table settings
  add column if not exists active_layout text not null default 'pairs'
  check (active_layout in ('pairs', 'mosaic', 'columns'));

-- 3) "CURRENT SHOW" EVENT STATUS — adds On View Now alongside upcoming/past/cancelled.
alter table events drop constraint if exists events_status_check;
alter table events
  add constraint events_status_check
  check (status in ('upcoming', 'current', 'past', 'cancelled'));

-- 4) SHOW ONE PAINTING IN SEVERAL GALLERIES — the "Also show in" tick boxes.
create table if not exists painting_sections (
  painting_id uuid not null references paintings(id) on delete cascade,
  section_id  uuid not null references sections(id)  on delete cascade,
  created_at  timestamptz default now(),
  primary key (painting_id, section_id)
);

create index if not exists painting_sections_section_idx
  on painting_sections (section_id);

alter table painting_sections enable row level security;

drop policy if exists "public read painting_sections" on painting_sections;
create policy "public read painting_sections"
  on painting_sections for select using (true);

drop policy if exists "auth all painting_sections" on painting_sections;
create policy "auth all painting_sections"
  on painting_sections for all using (auth.role() = 'authenticated');
```

## What you unlock

| Feature | Where it shows up |
| --- | --- |
| Focal point (stop faces being cropped) | Admin → Settings (under each photo) and Admin → Bio |
| Gallery layout switcher | Admin → Gallery layout ("Make this the site layout") |
| "On View Now" current-show status | Admin → Events (status dropdown) |
| Show a painting in several galleries | Admin → Portfolio → the Move button → "Also show in" |

## Already done

- Editable page text (tagline, commission intro, contact intro) — run earlier ✅
