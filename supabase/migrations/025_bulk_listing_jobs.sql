-- Bulk listing jobs: spreadsheet rows saved and processed one-by-one.

create table if not exists public.bulk_listing_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  batch_id uuid not null,
  product_url text not null,
  platform text not null check (platform in ('ebay', 'amazef')),
  profit_percent numeric(5, 2),
  status text not null default 'queued'
    check (status in ('queued', 'listing', 'listed', 'failed')),
  error_message text,
  listing_url text,
  listed_title text,
  listed_price numeric(12, 2),
  currency text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create index if not exists bulk_listing_jobs_user_id_idx on public.bulk_listing_jobs (user_id);
create index if not exists bulk_listing_jobs_batch_id_idx on public.bulk_listing_jobs (batch_id);
create index if not exists bulk_listing_jobs_status_idx on public.bulk_listing_jobs (user_id, status);
create index if not exists bulk_listing_jobs_created_at_idx on public.bulk_listing_jobs (created_at desc);

alter table public.bulk_listing_jobs enable row level security;

drop policy if exists "Service role full access on bulk_listing_jobs" on public.bulk_listing_jobs;
create policy "Service role full access on bulk_listing_jobs"
  on public.bulk_listing_jobs for all
  using (auth.role() = 'service_role');
