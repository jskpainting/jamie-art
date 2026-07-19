-- Task: add a "current" (On View Now / Active show) event status.
-- Widens the events.status CHECK constraint from ('upcoming','past','cancelled')
-- to also allow 'current'. Idempotent: safe to run more than once.

alter table events drop constraint if exists events_status_check;

alter table events
  add constraint events_status_check
  check (status in ('upcoming', 'current', 'past', 'cancelled'));
