-- Run in Supabase SQL Editor after 003_email_otps.sql
-- Safe to re-run

create table if not exists public.hunt_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  keyword text not null,
  platform text not null default 'amazef',
  status text not null default 'processing',
  product_count integer not null default 0,
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists public.hunt_products (
  id uuid primary key default gen_random_uuid(),
  hunt_request_id uuid not null references public.hunt_requests (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  external_id text,
  product_name text not null,
  keyword text not null,
  price numeric(12, 2),
  currency text not null default 'USD',
  score integer,
  orders_count text,
  image_url text,
  product_url text,
  source text not null default 'amazef',
  created_at timestamptz not null default now()
);

create index if not exists hunt_requests_user_id_idx on public.hunt_requests (user_id);
create index if not exists hunt_requests_created_at_idx on public.hunt_requests (created_at desc);
create index if not exists hunt_products_user_id_idx on public.hunt_products (user_id);
create index if not exists hunt_products_request_id_idx on public.hunt_products (hunt_request_id);

alter table public.hunt_requests enable row level security;
alter table public.hunt_products enable row level security;

drop policy if exists "Service role full access on hunt_requests" on public.hunt_requests;
create policy "Service role full access on hunt_requests"
  on public.hunt_requests for all
  using (auth.role() = 'service_role');

drop policy if exists "Service role full access on hunt_products" on public.hunt_products;
create policy "Service role full access on hunt_products"
  on public.hunt_products for all
  using (auth.role() = 'service_role');
