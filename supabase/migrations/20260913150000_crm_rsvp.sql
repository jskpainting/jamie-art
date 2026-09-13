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
