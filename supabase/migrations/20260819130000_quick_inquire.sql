-- Task: one-tap "inquire about this painting" from the painting page.
--
-- The visitor gets a message that is already written for them; they can edit it
-- and send it either as a TEXT MESSAGE to the owner's phone or through the
-- website form (which is logged in Admin -> Inquiries).
--
-- `inquiry_message_template` is the pre-filled text. It supports simple
-- placeholders that the site substitutes at render time:
--     {painting}  -> the painting's title
--     {artist}    -> the artist's name
-- Leaving it empty falls back to the built-in default in lib/site-copy.ts.
--
-- `inquiry_sms_enabled` controls whether the "Text" option is offered at all
-- (it also requires settings.phone to be set).
--
-- Additive and idempotent — safe to run more than once.

alter table settings add column if not exists inquiry_message_template text;
alter table settings add column if not exists inquiry_sms_enabled boolean not null default true;
