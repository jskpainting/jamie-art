-- Focal points + active portfolio layout.
--
-- Focal point: percentage coordinates (0–100) into each stored image, so the
-- owner can mark the important region (e.g. a face) and cropped renders keep it
-- in view. 50/50 = center = exactly today's behavior, so nothing changes until
-- the owner moves a point. Additive + defaulted → safe/idempotent, and the app
-- gates the new admin controls behind lib/schema-capabilities.ts until this runs.

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

-- Which portfolio gallery layout is live. 'pairs' = the current two-per-row wall.
alter table settings
  add column if not exists active_layout text not null default 'pairs'
  check (active_layout in ('pairs', 'mosaic', 'columns'));
