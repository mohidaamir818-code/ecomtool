-- Per-user eBay OAuth tokens for Sell API (listing)

create table if not exists public.ebay_oauth_tokens (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scope text,
  token_type text,
  ebay_username text,
  raw_response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ebay_oauth_tokens_user_id_idx
  on public.ebay_oauth_tokens (user_id);

create or replace function public.set_ebay_oauth_tokens_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_ebay_oauth_tokens_updated_at on public.ebay_oauth_tokens;
create trigger set_ebay_oauth_tokens_updated_at
before update on public.ebay_oauth_tokens
for each row
execute function public.set_ebay_oauth_tokens_updated_at();

alter table public.ebay_oauth_tokens enable row level security;

drop policy if exists "service role manages ebay oauth tokens" on public.ebay_oauth_tokens;
create policy "service role manages ebay oauth tokens"
on public.ebay_oauth_tokens
for all
to service_role
using (true)
with check (true);
