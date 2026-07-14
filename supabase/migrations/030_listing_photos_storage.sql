-- Public storage for seller-uploaded listing photos (used by auto-list review).
insert into storage.buckets (id, name, public)
values ('listing-photos', 'listing-photos', true)
on conflict (id) do nothing;

drop policy if exists "Public read listing photos" on storage.objects;
create policy "Public read listing photos"
  on storage.objects for select
  using (bucket_id = 'listing-photos');

drop policy if exists "Service role write listing photos" on storage.objects;
create policy "Service role write listing photos"
  on storage.objects for insert
  with check (bucket_id = 'listing-photos');
