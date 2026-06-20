-- Seller fee preferences and wizard draft auto-save

create table if not exists public.listing_fee_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  ebay_final_value_fee_percent numeric(6, 3) not null default 13.25,
  ebay_transaction_fee numeric(10, 2) not null default 0.30,
  payment_fee_percent numeric(6, 3) not null default 2.9,
  profit_margin_percent numeric(6, 3) not null default 30,
  shipping_cost numeric(10, 2) not null default 0,
  currency text not null default 'GBP',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.listing_wizard_drafts (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  product_url text,
  current_step integer not null default 0,
  draft_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists listing_wizard_drafts_updated_at_idx
  on public.listing_wizard_drafts (updated_at desc);

alter table public.listing_fee_preferences enable row level security;
alter table public.listing_wizard_drafts enable row level security;
