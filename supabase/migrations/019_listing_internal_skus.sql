-- Internal listing SKUs (independent of supplier SKU/ID)
-- Safe to re-run

create sequence if not exists public.listing_sku_seq start 100234;

create table if not exists public.listing_internal_skus (
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_key text not null,
  base_sku text not null,
  variant_skus jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (user_id, product_key)
);

create index if not exists listing_internal_skus_user_id_idx
  on public.listing_internal_skus (user_id);

create or replace function public.next_listing_sku_seq()
returns bigint
language sql
security definer
set search_path = public
as $$
  select nextval('public.listing_sku_seq');
$$;

alter table public.listing_internal_skus enable row level security;

drop policy if exists "Service role full access on listing_internal_skus" on public.listing_internal_skus;
create policy "Service role full access on listing_internal_skus"
  on public.listing_internal_skus for all
  using (auth.role() = 'service_role');
