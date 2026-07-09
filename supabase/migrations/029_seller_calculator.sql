-- Run in Supabase SQL Editor after 028_market_price_cache.sql
-- Safe to re-run

create table if not exists public.seller_calculator_months (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  year integer not null,
  month integer not null check (month between 1 and 12),
  status text not null default 'open',
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, year, month)
);

create table if not exists public.seller_calculator_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  month_id uuid not null references public.seller_calculator_months (id) on delete cascade,
  ebay_order_id text not null,
  order_date date not null,
  supplier_order_id text,
  buyer_name text,
  cost_price numeric(12, 2) not null default 0,
  selling_price numeric(12, 2) not null default 0,
  fees numeric(12, 2) not null default 0,
  net_sale numeric(12, 2) not null default 0,
  profit numeric(12, 2) not null default 0,
  roi numeric(8, 2),
  refund_amount numeric(12, 2) not null default 0,
  payout_amount numeric(12, 2),
  order_status text not null default 'completed',
  currency text not null default 'GBP',
  created_at timestamptz not null default now(),
  unique (user_id, ebay_order_id)
);

create index if not exists seller_calculator_months_user_idx
  on public.seller_calculator_months (user_id, year desc, month desc);

create index if not exists seller_calculator_orders_month_idx
  on public.seller_calculator_orders (month_id, order_date asc);

create index if not exists seller_calculator_orders_user_idx
  on public.seller_calculator_orders (user_id);

alter table public.seller_calculator_months enable row level security;
alter table public.seller_calculator_orders enable row level security;

drop policy if exists "Service role full access on seller_calculator_months" on public.seller_calculator_months;
create policy "Service role full access on seller_calculator_months"
  on public.seller_calculator_months for all
  using (auth.role() = 'service_role');

drop policy if exists "Service role full access on seller_calculator_orders" on public.seller_calculator_orders;
create policy "Service role full access on seller_calculator_orders"
  on public.seller_calculator_orders for all
  using (auth.role() = 'service_role');
