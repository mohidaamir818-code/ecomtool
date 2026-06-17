-- Run after 007_handling_products.sql
-- Stores AliExpress OAuth tokens for Dropship API access

create table if not exists public.aliexpress_oauth_tokens (
  provider text primary key,
  access_token text not null,
  refresh_token text not null,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scope text,
  token_type text,
  raw_response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_aliexpress_oauth_tokens_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_aliexpress_oauth_tokens_updated_at on public.aliexpress_oauth_tokens;
create trigger set_aliexpress_oauth_tokens_updated_at
before update on public.aliexpress_oauth_tokens
for each row
execute function public.set_aliexpress_oauth_tokens_updated_at();

alter table public.aliexpress_oauth_tokens enable row level security;

-- Only service-role server code should read/write this table.
drop policy if exists "service role manages aliexpress oauth tokens" on public.aliexpress_oauth_tokens;
create policy "service role manages aliexpress oauth tokens"
on public.aliexpress_oauth_tokens
for all
to service_role
using (true)
with check (true);
