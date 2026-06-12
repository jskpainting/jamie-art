alter table settings
  add column if not exists home_hero_image_url  text,
  add column if not exists about_image_url       text,
  add column if not exists commission_image_url  text;

-- site-images bucket (public read, auth write)
insert into storage.buckets (id, name, public)
values ('site-images', 'site-images', true)
on conflict (id) do nothing;

create policy "public read site-images"
  on storage.objects for select
  using (bucket_id = 'site-images');

create policy "auth insert site-images"
  on storage.objects for insert
  with check (bucket_id = 'site-images' and auth.role() = 'authenticated');

create policy "auth delete site-images"
  on storage.objects for delete
  using (bucket_id = 'site-images' and auth.role() = 'authenticated');
