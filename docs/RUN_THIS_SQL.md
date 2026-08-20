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
-- Non-destructive image editing: remembers, for every edited photo, the
-- untouched original it came from and what was done to it (crop +
-- brightness/contrast), so re-opening the editor never loses quality and
-- "Revert to original" always works.
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
```

Unlocks: the **Edit** (pencil) button and **"Revert to original"** on every
saved photo across the admin — paintings, headshot, events, gallery covers,
home/commission photos, and the media library. Everything else (upload, crop,
brightness/contrast) already works without this.

## What you unlock

| Feature | Where it shows up |
| --- | --- |
| Focal point (stop faces being cropped) | Admin → Settings (under each photo) and Admin → Bio |
| Gallery layout switcher | Admin → Gallery layout ("Make this the site layout") |
| "On View Now" current-show status | Admin → Events (status dropdown) |
| Show a painting in several galleries | Admin → Portfolio → the Move button → "Also show in" |
| Re-edit a saved photo losslessly / revert to original | Anywhere you upload an image |

## Already done

- Editable page text (tagline, commission intro, contact intro) — run earlier ✅
