-- Run in Supabase SQL Editor after 009_handling_variants.sql
-- Safe to re-run

create table if not exists public.competitor_watches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_query text not null,
  user_price numeric(12, 2) not null,
  currency text not null default 'GBP',
  update_mode text not null default 'manual',
  update_interval_hours integer,
  next_update_at timestamptz,
  last_checked_at timestamptz,
  matches_found integer not null default 0,
  products_searched integer not null default 0,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists public.competitor_watch_matches (
  id uuid primary key default gen_random_uuid(),
  watch_id uuid not null references public.competitor_watches (id) on delete cascade,
  external_product_id text,
  product_name text not null,
  competitor_price numeric(12, 2) not null,
  currency text not null default 'GBP',
  image_url text,
  product_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.competitor_watch_logs (
  id uuid primary key default gen_random_uuid(),
  watch_id uuid not null references public.competitor_watches (id) on delete cascade,
  matches_found integer not null default 0,
  change_summary text not null,
  created_at timestamptz not null default now()
);

create index if not exists competitor_watches_user_id_idx on public.competitor_watches (user_id);
create index if not exists competitor_watches_next_update_idx on public.competitor_watches (next_update_at);
create index if not exists competitor_watch_matches_watch_id_idx on public.competitor_watch_matches (watch_id);
create index if not exists competitor_watch_logs_watch_id_idx on public.competitor_watch_logs (watch_id);

alter table public.competitor_watches enable row level security;
alter table public.competitor_watch_matches enable row level security;
alter table public.competitor_watch_logs enable row level security;

drop policy if exists "Service role full access on competitor_watches" on public.competitor_watches;
create policy "Service role full access on competitor_watches"
  on public.competitor_watches for all
  using (auth.role() = 'service_role');

drop policy if exists "Service role full access on competitor_watch_matches" on public.competitor_watch_matches;
create policy "Service role full access on competitor_watch_matches"
  on public.competitor_watch_matches for all
  using (auth.role() = 'service_role');

drop policy if exists "Service role full access on competitor_watch_logs" on public.competitor_watch_logs;
create policy "Service role full access on competitor_watch_logs"
  on public.competitor_watch_logs for all
  using (auth.role() = 'service_role');
