alter table settings add column featured_painting_id uuid
  references paintings(id) on delete set null;
