-- Emails are case-insensitive: "Jane@Example.com" and "jane@example.com" are
-- the same person. The app now stores every contact / RSVP email trimmed and
-- lowercased; this brings existing rows in line and makes the database refuse
-- a second contact that differs only by case.
--
-- Safe to run more than once. Rows whose lowercased email would collide with
-- another existing row are left as they are (nothing is merged or deleted);
-- if any exist, the unique index at the end fails with a "could not create
-- unique index" error and those duplicates need tidying up by hand first.

-- 1) Existing contacts
update contacts c
set email = lower(trim(c.email))
where c.email <> lower(trim(c.email))
  and not exists (
    select 1 from contacts o
    where o.id <> c.id and lower(trim(o.email)) = lower(trim(c.email))
  );

-- 2) Existing RSVPs (unique per event + email)
update event_rsvps r
set email = lower(trim(r.email))
where r.email <> lower(trim(r.email))
  and not exists (
    select 1 from event_rsvps o
    where o.id <> r.id
      and o.event_id = r.event_id
      and lower(trim(o.email)) = lower(trim(r.email))
  );

-- 3) One contact per email, whatever the casing
create unique index if not exists contacts_email_lower_unique on contacts (lower(email));
