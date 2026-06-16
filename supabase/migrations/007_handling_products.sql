-- Run in Supabase SQL Editor after 006_competitor_checks.sql
-- Safe to re-run

create table if not exists public.handling_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  source text not null default 'aliexpress',
  external_id text not null,
  product_url text not null,
  title text not null,
  image_url text,
  price numeric(12, 2),
  currency text not null default 'GBP',
  stock integer,
  orders_count text,
  rating numeric(4, 2),
  update_mode text not null default 'manual',
  update_interval_hours integer,
  next_update_at timestamptz,
  last_checked_at timestamptz,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists public.handling_product_logs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.handling_products (id) on delete cascade,
  price numeric(12, 2),
  stock integer,
  change_summary text not null,
  created_at timestamptz not null default now()
);

create index if not exists handling_products_user_id_idx on public.handling_products (user_id);
create index if not exists handling_products_next_update_idx on public.handling_products (next_update_at);
create index if not exists handling_product_logs_product_id_idx on public.handling_product_logs (product_id);

alter table public.handling_products enable row level security;
alter table public.handling_product_logs enable row level security;

drop policy if exists "Service role full access on handling_products" on public.handling_products;
create policy "Service role full access on handling_products"
  on public.handling_products for all
  using (auth.role() = 'service_role');

drop policy if exists "Service role full access on handling_product_logs" on public.handling_product_logs;
create policy "Service role full access on handling_product_logs"
  on public.handling_product_logs for all
  using (auth.role() = 'service_role');
