-- Phase 6D-1: Newsletter blast tool
-- 1. Add unsubscribe token to contacts
alter table contacts add column unsubscribe_token uuid
  default gen_random_uuid() not null;

alter table contacts add constraint contacts_unsub_token_unique
  unique (unsubscribe_token);

-- Defensive backfill for any rows that somehow lack a token
update contacts
  set unsubscribe_token = gen_random_uuid()
  where unsubscribe_token is null;

-- 2. Newsletter sends audit log
create table newsletters (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  body_markdown text not null,
  body_html text not null,
  sent_at timestamptz default now(),
  sent_by_user_email text,
  recipient_count int not null,
  status text default 'completed'
    check (status in ('sending','completed','failed')),
  error_message text
);

alter table newsletters enable row level security;

create policy "auth all newsletters" on newsletters
  for all using (auth.role() = 'authenticated');
