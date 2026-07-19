-- Task: make more public copy editable from Admin → Settings.
-- Adds optional text columns to the single-row settings table. When a column
-- is null/empty the site falls back to its built-in default copy, so nothing
-- changes visually until the owner sets a value. Safe/idempotent.

alter table settings add column if not exists tagline text;
alter table settings add column if not exists commission_intro text;
alter table settings add column if not exists contact_intro text;
