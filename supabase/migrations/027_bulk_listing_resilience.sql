-- Bulk listing: server-side continuation + deferred VeRO handling.
--   settings  : snapshot of the auto-listing settings to use server-side (so the
--               cron can keep listing even after the seller closes the tab).
--   vero_ack  : set true once the seller approves listing the held VeRO products.
--   status    : adds 'vero_hold' for products parked awaiting VeRO permission.

alter table public.bulk_listing_jobs
  add column if not exists settings jsonb,
  add column if not exists vero_ack boolean not null default false;

alter table public.bulk_listing_jobs
  drop constraint if exists bulk_listing_jobs_status_check;

alter table public.bulk_listing_jobs
  add constraint bulk_listing_jobs_status_check
  check (status in ('queued', 'listing', 'listed', 'failed', 'vero_hold'));
