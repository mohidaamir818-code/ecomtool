-- Per-seller eBay inventory warehouse location (manual address, one-time setup)
-- Safe to re-run

create table if not exists public.ebay_seller_inventory_locations (
  seller_id uuid primary key references public.profiles (id) on delete cascade,
  city text not null,
  postal_code text not null,
  country char(2) not null,
  merchant_location_key text not null unique,
  address_confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ebay_seller_inventory_locations_seller_id_idx
  on public.ebay_seller_inventory_locations (seller_id);

create or replace function public.set_ebay_seller_inventory_locations_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_ebay_seller_inventory_locations_updated_at
  on public.ebay_seller_inventory_locations;
create trigger set_ebay_seller_inventory_locations_updated_at
before update on public.ebay_seller_inventory_locations
for each row
execute function public.set_ebay_seller_inventory_locations_updated_at();

alter table public.ebay_seller_inventory_locations enable row level security;

drop policy if exists "service role manages ebay seller inventory locations"
  on public.ebay_seller_inventory_locations;
create policy "service role manages ebay seller inventory locations"
  on public.ebay_seller_inventory_locations
  for all
  to service_role
  using (true)
  with check (true);
