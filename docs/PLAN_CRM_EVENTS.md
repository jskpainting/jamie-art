# Plan — People (private CRM), groups & tags, targeted newsletters, event RSVPs

Owner's ask (13 Sep 2026): one private list of people; track what each bought
and everything they did; CSV import; groups ("high-paying customers") and
tags; pick who gets a newsletter; events with a streamlined RSVP — invited
people click Yes with no form, strangers from the website fill name + email;
"invite everyone" from an event with an AI-drafted email and an RSVP button.
Internal only, nothing public except the RSVP page. Everything optional.

## What exists (reuse, don't rebuild)
- `contacts` (email unique, first/last name, `source`, `tags text[]`,
  `subscribed`, `unsubscribe_token`) + `/admin/contacts` list, add/edit dialog,
  CSV import (`email, first_name, last_name`), bulk unsubscribe, public signup
  (`/api/newsletter`), unsubscribe page.
- `newsletters` audit table + `sendNewsletter` (sends to ALL subscribed, one
  Resend call per contact, template in `lib/email/templates.ts` with
  `{unsubscribeUrl}`), the new "Write it for me" AI card, "Send a test to me".
- `events` (title, starts/ends, location, description, link, image, status
  upcoming/current/past/cancelled) + admin dialog + public `/events` cards.
- `inquiries` / `commission_inquiries` (by email — link to people by email, no
  schema change).
- Patterns: server actions with `getUser()` guard + Zod + `revalidatePath`;
  `lib/schema-capabilities.ts` gating; `ConfirmDialog`; `ListToolbar`;
  `PaintingPicker`; `OptionSelect`/`TagPicker` (select + "Other…").

## 1. Database (one migration, owner-applied: `supabase/migrations/20260913150000_crm_rsvp.sql`, copy into `docs/RUN_THIS_SQL.md`)

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

Capabilities (`lib/schema-capabilities.ts`): `crm` (probe `contact_groups`),
`rsvp` (probe `event_rsvps`). All new UI hides behind them with the standard
setup message; existing pages keep working before the SQL runs.

## 2. Data layer (`lib/actions/crm.ts`, `lib/actions/rsvp.ts`, `lib/db/queries.ts`, `lib/types.ts`, `lib/schemas.ts`)

Types mirror the tables exactly (`ContactGroup`, `Purchase`,
`ContactActivity`, `EventRsvp`, `NewsletterAudience`), plus
`ContactDetail = Contact & { groups, purchases (with painting title/slug/
section), rsvps (with event title/date), inquiries, commissionInquiries,
newsletters (subject, sent_at), activities }` and `ContactRow = Contact &
{ group_names: string[]; purchase_count: number; last_activity_at }`.

`lib/actions/crm.ts` (all `getUser()`-guarded, Zod, revalidate
`/admin/contacts` + `/admin/contacts/[id]`):
- Groups: `getGroups()` (with member counts), `createGroup(name, description?)`,
  `renameGroup(id, name)`, `deleteGroup(id)`, `setContactGroups(contactId, groupIds[])`,
  `bulkAddToGroup(contactIds[], groupId)`, `bulkRemoveFromGroup`.
- Tags (stay on `contacts.tags text[]`): `getContactTags()` (distinct + counts),
  `bulkAddTag(contactIds[], tag)`, `bulkRemoveTag`, `renameTag(old, new)`
  (update every contact), `deleteTag(tag)`.
- Details: `updateContactDetails(id, { first_name, last_name, phone, city, notes, subscribed, tags })`.
- Purchases: `addPurchase(contactId, { painting_id?, title?, price_cents?, purchased_on?, notes? })`
  — when `painting_id` is given and `title`/`price_cents` are blank, snapshot
  them from the painting; optionally (`markSold: boolean`) set the painting's
  status to `sold` and `sold_at`. `updatePurchase`, `deletePurchase`.
  `findOrCreateContact({ email, first_name?, last_name?, source })` for the
  "Sold to" flow from the painting dialog.
- Activities: `addNote(contactId, text)`; internal `logActivity(contactId, kind, summary, refId?)`
  used by every writer above and by RSVP/newsletter code. Never throws.
- Audience: `countAudience(audience)` and `resolveAudience(audience)` →
  subscribed contact ids for `{type:"all"} | {type:"groups", ids} | {type:"tags", names} | {type:"people", ids}`.
- CSV: extend `importContacts` rows with optional `phone, city, tags` (split on `;` or `,`),
  `group` (name → create if missing → add member), `notes`; existing email →
  fill only blank fields, never overwrite; log `import` activity.

`lib/actions/rsvp.ts`:
- Admin: `getEventRsvps(eventId)`, `setRsvpStatus(id, status)` (admin override), `deleteRsvp`,
  `createInvites(eventId, contactIds[])` → upsert `event_rsvps` rows with status
  `invited`, `source='email'`, returning `{ contactId, token }[]` (used by the
  invite send), `exportRsvpsCsv(eventId)` (string).
- Public (called by the route handler with the admin client, rate-limited by IP via `lib/rate-limit.ts`):
  `respondByToken(token, { status, guests, note? })` — no name/email needed;
  `respondPublic(eventId, { name, email, status, guests, keepMePosted })` — upsert by
  (event_id, email); `findOrCreateContact(email, source:'rsvp')`, set
  `subscribed = keepMePosted || existing.subscribed`; log `rsvp` activity.
  Refuse when the event is past/cancelled or `rsvp_enabled=false`, and when
  `rsvp_limit` is reached (return `{ ok:false, reason:"full" }` → page says
  "This event is full — we'll let you know if a spot opens").

Queries: `getContactRows()` (list with group names + purchase counts, one
query each, joined in memory), `getContactDetail(id)`, `getEventRsvpCounts()`
(map eventId → {yes,no,maybe,invited}), `getEventForRsvp(id)` (public, admin client).

## 3. People admin (`/admin/contacts`) — rename nav label to "People"
- Toolbar: search (name/email/phone), filters: Subscribed / Unsubscribed /
  Has purchases / Group = … / Tag = …; sort: newest, name, last activity.
- Row: name (link to detail), email, chips (groups solid, tags outline),
  purchases count, subscribed dot. Bulk bar (selection): Add to group ▾,
  Add tag, Unsubscribe, Export CSV.
- Header buttons: **Add person**, **Import CSV** (extended columns; template
  download link `email,first_name,last_name,phone,city,tags,group,notes`),
  **Groups & tags** (dialog: two tabs; create/rename/delete with counts;
  confirm on delete).
- Detail page `/admin/contacts/[id]`: left column card with editable
  fields (name, email read-only, phone, city, subscribed switch, groups
  multi-select chips, tags `TagPicker`-style, notes textarea, Save). Right:
  **Purchases** (list + "Add purchase": `PaintingPicker` or "Something else"
  free text; price prefilled; date; notes; "Also mark the painting as sold"
  checkbox when a painting is picked), **Events** (RSVPs with status),
  **Enquiries** (by email, both tables, link to inquiries page), **Emails
  received** (newsletter subjects + dates), **Timeline** (activities newest
  first, "Add a note"). Empty states are one quiet line each.
- Painting dialog: when Status is set to Sold, show an optional "Sold to"
  field (search people by name/email; "Add new person" inline with email +
  name) → on save calls `addPurchase` with `markSold`. Entirely optional.

## 4. Newsletters: choose who gets it
- Compose card gains **"Who gets this"**: radio All subscribers (N) ·
  Groups (multi-select chips) · Tags (chips) · Pick people (search + checklist).
  Live count via `countAudience`. Send confirm shows the count and the label.
- `sendNewsletter` takes `audience` (default all) and optional `eventId`;
  writes `newsletters.audience/event_id`, inserts `newsletter_recipients`,
  logs a `newsletter` activity per contact, and — when `eventId` is set —
  calls `createInvites` first and renders a per-recipient RSVP button.
- Template: support a `{{RSVP_BUTTON}}` placeholder (and `{{FIRST_NAME}}`)
  in the markdown; `renderNewsletterHtml` receives `rsvpUrl` and replaces the
  placeholder with a bulletproof table button "RSVP — I'll be there" linking
  to `${SITE_URL}/rsvp/${eventId}?t=${token}`; plain-text gets the URL. If the
  placeholder is absent but `eventId` is set, append the button before the
  signature. "Send a test to me" uses a `preview` token that lands on the
  public form.
- Past sends table shows the audience label and, for event emails, the
  Yes/No counts.

## 5. Events + RSVP
- Event dialog: "Let people RSVP" switch; when on: "Note shown on the RSVP
  page" (optional) and "Limit spots" (optional number). Admin event row: RSVP
  counts chip "8 yes · 2 no · 15 invited" linking to `/admin/events/[id]/rsvps`
  (table: name, email, status, guests, source, when; inline status override;
  Export CSV; "Invite people" button → `/admin/newsletters?event=<id>`).
- Newsletters page with `?event=`: pre-fills the "Write it for me" request
  ("Invite people to <title> on <date> at <location>…"), sets `eventId`, and
  inserts `{{RSVP_BUTTON}}` into the body; audience defaults to All.
- Public `/rsvp/[eventId]` (route group `(public)`, `robots: noindex`):
  event title, date/location, image, note. Two modes:
  - With `?t=<token>` matching an `invited|yes|no|maybe` row: "Hi <first name> —
    are you coming?" and two big buttons **Yes, I'll be there** / **Can't make
    it**, plus a guests stepper (1–10) that appears after Yes. One tap = done;
    confirmation state with "Change my answer". No name/email fields.
  - Without a token (or an invalid one): the same buttons plus Name + Email
    fields (required) and a "Keep me posted about new work and shows"
    checkbox (unchecked by default). Submitting upserts by email; if the email
    already has an invite for this event, that row is updated.
  - Full / past / disabled events show a friendly single-line message.
  - Route handler `POST /api/rsvp` (Zod, IP rate limit 10/min, honeypot field)
    does the write; the page is a small client form.
- Public event cards: when `rsvp_enabled` and the event is upcoming/current,
  show an **RSVP** button linking to `/rsvp/[id]` next to the existing link.
- Dashboard: "Upcoming: <event> — 8 yes" line when any event has RSVPs.

## 6. Automation the system does by itself
- Public newsletter signup → `signup` activity. Inquiry/commission form →
  `findOrCreateContact(source:'inquiry', subscribed:false)` + `inquiry` activity
  (so every enquirer becomes a person you can see, without subscribing them).
- Newsletter send → `newsletter` activity per recipient; RSVP → `rsvp`
  activity; purchase → `purchase` activity; CSV import → `import`.

## Execution (Sonnet agents, disjoint files)
- **L (first):** migration + RUN_THIS_SQL + capabilities + types + schemas +
  queries + `lib/actions/crm.ts` + `lib/actions/rsvp.ts` + CSV import action
  changes + the signup/inquiry hooks. tsc/lint; no UI.
- Then in parallel:
  - **M:** People UI (§3) incl. painting-dialog "Sold to" and nav label.
  - **N:** Events + public RSVP (§5) incl. `/api/rsvp`, event cards, admin RSVP page.
  - **O:** Newsletter audience + invites + template placeholders (§4) + `?event=` prefill + past-sends columns + dashboard line.
- Lead: build, lint, click-through on localhost (RSVP both modes, purchase
  add, audience count), commit per agent, push, verify production counts,
  then the owner runs the SQL block and tests RSVP on his phone.
