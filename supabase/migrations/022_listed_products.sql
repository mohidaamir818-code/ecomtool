-- Published listings saved after successful eBay/Amazef list

create table if not exists public.listed_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null check (platform in ('ebay', 'amazef')),
  aliexpress_url text not null,
  aliexpress_external_id text not null,
  handling_product_id uuid references public.handling_products (id) on delete set null,
  title text not null,
  image_url text,
  currency text not null default 'GBP',
  listing_url text,
  listing_id text,
  group_sku text,
  offer_id text,
  draft_json jsonb not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.listed_product_variants (
  id uuid primary key default gen_random_uuid(),
  listed_product_id uuid not null references public.listed_products (id) on delete cascade,
  ali_variant_id text not null,
  label text not null,
  sku text not null,
  offer_id text,
  listed_price numeric(12, 2) not null,
  listed_quantity integer not null default 1,
  ali_price numeric(12, 2) not null,
  ali_stock integer,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists listed_products_user_id_idx on public.listed_products (user_id);
create index if not exists listed_products_external_idx on public.listed_products (user_id, aliexpress_external_id);
create index if not exists listed_products_handling_idx on public.listed_products (handling_product_id);
create index if not exists listed_product_variants_product_idx on public.listed_product_variants (listed_product_id);
create unique index if not exists listed_product_variants_sku_idx on public.listed_product_variants (listed_product_id, sku);

alter table public.listed_products enable row level security;
alter table public.listed_product_variants enable row level security;

drop policy if exists "Service role full access on listed_products" on public.listed_products;
create policy "Service role full access on listed_products"
  on public.listed_products for all
  using (auth.role() = 'service_role');

drop policy if exists "Service role full access on listed_product_variants" on public.listed_product_variants;
create policy "Service role full access on listed_product_variants"
  on public.listed_product_variants for all
  using (auth.role() = 'service_role');
