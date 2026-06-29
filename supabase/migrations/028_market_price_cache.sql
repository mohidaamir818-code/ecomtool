-- Smart pricing: cache of eBay competitor average prices.
-- Keeps API usage low — one Browse API call per product is cached for ~24h and
-- reused across listings/sellers, so smart pricing never hammers eBay limits.
--   cache_key   : normalized search query + marketplace (unique).
--   avg_price   : trimmed mean of competitor total prices.
--   median_price: median competitor total price (more robust to outliers).
--   sample_size : number of competitor listings the average is based on.

create table if not exists public.market_price_cache (
  id uuid primary key default gen_random_uuid(),
  cache_key text not null unique,
  marketplace_id text not null default 'EBAY_GB',
  query text not null,
  avg_price numeric not null default 0,
  median_price numeric not null default 0,
  sample_size integer not null default 0,
  currency text not null default 'GBP',
  fetched_at timestamptz not null default now()
);

create index if not exists idx_market_price_cache_key
  on public.market_price_cache (cache_key);

create index if not exists idx_market_price_cache_fetched_at
  on public.market_price_cache (fetched_at);
