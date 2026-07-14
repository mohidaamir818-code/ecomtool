-- Bulk listing: prepare-only flow — store draft JSON and new job statuses.

alter table public.bulk_listing_jobs
  add column if not exists draft_json jsonb;

alter table public.bulk_listing_jobs
  drop constraint if exists bulk_listing_jobs_status_check;

alter table public.bulk_listing_jobs
  add constraint bulk_listing_jobs_status_check
  check (status in ('queued', 'preparing', 'prepared', 'listing', 'listed', 'failed', 'vero_hold'));
