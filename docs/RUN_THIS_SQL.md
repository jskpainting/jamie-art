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

---

# Round 2 — passkeys + Commission page text

Run this the same way (SQL Editor → New query → paste → **Run**).

```sql
-- 1) PASSKEYS — lets you sign in with Face ID, Touch ID, Windows Hello, or an
--    Android fingerprint. Stores one row per device you register.
create table if not exists webauthn_credentials (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null,
  credential_id text not null unique,
  public_key    text not null,
  counter       bigint not null default 0,
  transports    text[] default '{}',
  device_label  text,
  created_at    timestamptz default now(),
  last_used_at  timestamptz
);

create index if not exists webauthn_credentials_user_idx
  on webauthn_credentials (user_id);

alter table webauthn_credentials enable row level security;

drop policy if exists "public read webauthn_credentials" on webauthn_credentials;
drop policy if exists "auth all webauthn_credentials"   on webauthn_credentials;

-- 2) COMMISSION PAGE TEXT — makes the small label and the heading editable
--    from Admin → Commission page (the intro paragraph already is).
alter table settings add column if not exists commission_eyebrow text;
alter table settings add column if not exists commission_heading text;
```

Unlocks: **Sign in with Face ID / fingerprint** (Account → Passkeys) and the
**label + heading** fields on Admin → Commission page.

---

# Round 3 — AI stories + one-tap "ask about this painting"

Same steps (SQL Editor → New query → paste → **Run**).

```sql
-- 1) STORIES — lets the AI turn your rough notes into a short story, and lets
--    you keep a story private (saved, but hidden from the website).
alter table paintings add column if not exists story_public boolean not null default true;
alter table paintings add column if not exists story_notes text;

-- 2) ASK ABOUT THIS PAINTING — the pre-written message visitors send you, and
--    whether they can send it as a text message to your phone.
alter table settings add column if not exists inquiry_message_template text;
alter table settings add column if not exists inquiry_sms_enabled boolean not null default true;
```

Unlocks: the **"Write it for me"** button and **"Show this story on the website"**
switch in the painting form, plus the **"When someone asks about a painting"**
card in Settings (edit the pre-written message, turn texting on/off).

> Printable **Show cards** need no SQL at all — they work as soon as the code is live.

---

# Round 4 — Non-destructive image editing

Same steps (SQL Editor → New query → paste → **Run**).

```sql
-- 1) NON-DESTRUCTIVE IMAGE EDITING — remembers, for every edited photo, the
--    untouched original it came from and what was done to it (crop +
--    brightness/contrast), so re-opening the editor never loses quality and
--    "Revert to original" always works.
create table if not exists image_edits (
  id            uuid primary key default gen_random_uuid(),
  bucket        text not null,
  path          text not null,
  source_bucket text not null,
  source_path   text not null,
  recipe        jsonb not null default '{}',
  created_at    timestamptz default now(),
  unique (bucket, path)
);

alter table image_edits enable row level security;

drop policy if exists "auth all image_edits" on image_edits;
create policy "auth all image_edits"
  on image_edits for all using (auth.role() = 'authenticated');

-- 2) PAINTING DETAILS LISTS — remembers your mediums and sizes for the dropdowns
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
```

Unlocks: the **Edit** (pencil) button and **"Revert to original"** on every
saved photo across the admin — paintings, headshot, events, gallery covers,
home/commission photos, and the media library. Everything else (upload, crop,
brightness/contrast) already works without this. Also unlocks the **remembered
Medium and Size choices** (recent-first dropdowns with "Other…") on the
painting form, bulk upload, and the new "Painting details lists" card in
Admin → Settings.

---

# Round 5 — PEOPLE, GROUPS, PURCHASES & EVENT RSVPs

Lets you track who bought what and who's coming to a show. Same steps (SQL
Editor → New query → paste → **Run**).

```sql
-- People: a few optional details
alter table contacts add column if not exists phone text;
alter table contacts add column if not exists notes text;
alter table contacts add column if not exists city text;
alter table contacts add column if not exists updated_at timestamptz default now();

-- Groups (owner-named lists of people)
create table if not exists contact_groups (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  description text,
  created_at timestamptz default now()
);
create table if not exists contact_group_members (
  contact_id uuid not null references contacts(id) on delete cascade,
  group_id   uuid not null references contact_groups(id) on delete cascade,
  added_at timestamptz default now(),
  primary key (contact_id, group_id)
);

-- Purchases (what a person bought; painting optional, free-text fallback)
create table if not exists purchases (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts(id) on delete cascade,
  painting_id uuid references paintings(id) on delete set null,
  title text,                    -- snapshot / free text when no painting
  price_cents int,
  purchased_on date,
  notes text,
  created_at timestamptz default now()
);
create index if not exists purchases_contact_idx on purchases(contact_id);
create index if not exists purchases_painting_idx on purchases(painting_id);

-- Timeline (system-written; owner can add notes)
create table if not exists contact_activities (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts(id) on delete cascade,
  kind text not null check (kind in ('note','purchase','rsvp','newsletter','inquiry','signup','import','group','tag')),
  summary text not null,
  ref_id uuid,
  created_at timestamptz default now()
);
create index if not exists contact_activities_contact_idx on contact_activities(contact_id, created_at desc);

-- Events: RSVP switch
alter table events add column if not exists rsvp_enabled boolean not null default false;
alter table events add column if not exists rsvp_note text;          -- e.g. "Doors 6pm, wine served"
alter table events add column if not exists rsvp_limit int;          -- optional cap on 'yes'

create table if not exists event_rsvps (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  email text not null,
  name text,
  status text not null default 'invited' check (status in ('invited','yes','no','maybe')),
  guests int not null default 1 check (guests between 1 and 10),
  source text not null default 'site' check (source in ('site','email','admin')),
  token uuid unique not null default gen_random_uuid(),
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (event_id, email)
);
create index if not exists event_rsvps_event_idx on event_rsvps(event_id);

-- Newsletters: who it went to
alter table newsletters add column if not exists event_id uuid references events(id) on delete set null;
alter table newsletters add column if not exists audience jsonb;     -- {"type":"all"|"groups"|"tags"|"people","ids":[...],"label":"…"}
create table if not exists newsletter_recipients (
  newsletter_id uuid not null references newsletters(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  status text not null default 'sent' check (status in ('sent','failed')),
  primary key (newsletter_id, contact_id)
);

-- RLS: owner only. The public RSVP page writes through the server (admin client), never directly.
alter table contact_groups enable row level security;
alter table contact_group_members enable row level security;
alter table purchases enable row level security;
alter table contact_activities enable row level security;
alter table event_rsvps enable row level security;
alter table newsletter_recipients enable row level security;
drop policy if exists "auth all contact_groups" on contact_groups;
create policy "auth all contact_groups" on contact_groups for all using (auth.role() = 'authenticated');
drop policy if exists "auth all contact_group_members" on contact_group_members;
create policy "auth all contact_group_members" on contact_group_members for all using (auth.role() = 'authenticated');
drop policy if exists "auth all purchases" on purchases;
create policy "auth all purchases" on purchases for all using (auth.role() = 'authenticated');
drop policy if exists "auth all contact_activities" on contact_activities;
create policy "auth all contact_activities" on contact_activities for all using (auth.role() = 'authenticated');
drop policy if exists "auth all event_rsvps" on event_rsvps;
create policy "auth all event_rsvps" on event_rsvps for all using (auth.role() = 'authenticated');
drop policy if exists "auth all newsletter_recipients" on newsletter_recipients;
create policy "auth all newsletter_recipients" on newsletter_recipients for all using (auth.role() = 'authenticated');
```

Unlocks: **People** (renamed from Contacts) with phone/city/notes, groups and
purchase history per person; picking exactly who a newsletter goes to
(everyone, a group, a tag, or hand-picked people); and event RSVPs — invited
people click Yes with no form, strangers from the website fill in name +
email, and "invite everyone" from an event with an AI-drafted email and an
RSVP button.

## What you unlock

| Feature | Where it shows up |
| --- | --- |
| Focal point (stop faces being cropped) | Admin → Settings (under each photo) and Admin → Bio |
| Gallery layout switcher | Admin → Gallery layout ("Make this the site layout") |
| "On View Now" current-show status | Admin → Events (status dropdown) |
| Show a painting in several galleries | Admin → Portfolio → the Move button → "Also show in" |
| Re-edit a saved photo losslessly / revert to original | Anywhere you upload an image |
| People, groups, purchases & event RSVPs | Admin → People, Admin → Events, public `/rsvp/[eventId]` |

## Already done

- Editable page text (tagline, commission intro, contact intro) — run earlier ✅
