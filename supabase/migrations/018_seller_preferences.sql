-- Unified seller preferences (fees + volume discounts)

create table if not exists public.seller_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  ebay_final_value_fee_percent numeric(6, 3) not null default 13.25,
  transaction_fee_amount numeric(10, 2) not null default 0.30,
  payment_fee_percent numeric(6, 3) not null default 2.9,
  profit_margin_percent numeric(6, 3) not null default 30,
  shipping_cost numeric(10, 2) not null default 0,
  currency text not null default 'GBP',
  buy_2_discount_percent numeric(5, 2) not null default 0,
  buy_3_discount_percent numeric(5, 2) not null default 0,
  buy_5_discount_percent numeric(5, 2) not null default 0,
  buy_10_discount_percent numeric(5, 2) not null default 0,
  buy_2_enabled boolean not null default false,
  buy_3_enabled boolean not null default false,
  buy_5_enabled boolean not null default false,
  buy_10_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists seller_preferences_updated_at_idx
  on public.seller_preferences (updated_at desc);

alter table public.seller_preferences enable row level security;
