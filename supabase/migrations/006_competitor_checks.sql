-- Run in Supabase SQL Editor after 005_hunt_lookback_days.sql
-- Safe to re-run

create table if not exists public.competitor_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_query text not null,
  user_price numeric(12, 2) not null,
  currency text not null default 'GBP',
  matches_found integer not null default 0,
  products_searched integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.competitor_matches (
  id uuid primary key default gen_random_uuid(),
  check_id uuid not null references public.competitor_checks (id) on delete cascade,
  external_product_id text,
  product_name text not null,
  competitor_price numeric(12, 2) not null,
  currency text not null default 'GBP',
  image_url text,
  product_url text,
  created_at timestamptz not null default now()
);

create index if not exists competitor_checks_user_id_idx on public.competitor_checks (user_id);
create index if not exists competitor_checks_created_at_idx on public.competitor_checks (created_at desc);
create index if not exists competitor_matches_check_id_idx on public.competitor_matches (check_id);

alter table public.competitor_checks enable row level security;
alter table public.competitor_matches enable row level security;

drop policy if exists "Service role full access on competitor_checks" on public.competitor_checks;
create policy "Service role full access on competitor_checks"
  on public.competitor_checks for all
  using (auth.role() = 'service_role');

drop policy if exists "Service role full access on competitor_matches" on public.competitor_matches;
create policy "Service role full access on competitor_matches"
  on public.competitor_matches for all
  using (auth.role() = 'service_role');
