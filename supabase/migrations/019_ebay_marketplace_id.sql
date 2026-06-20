-- Store seller eBay marketplace detected at OAuth connect

alter table public.ebay_oauth_tokens
  add column if not exists marketplace_id text;
