-- Fix eBay OAuth token saves blocked by RLS (AI Listing connect flow)
-- Safe to re-run in Supabase SQL Editor

alter table public.ebay_oauth_tokens enable row level security;
alter table public.ebay_oauth_tokens no force row level security;

drop policy if exists "service role manages ebay oauth tokens" on public.ebay_oauth_tokens;
drop policy if exists "Service role full access" on public.ebay_oauth_tokens;

create policy "Service role full access"
  on public.ebay_oauth_tokens for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Security-definer upsert bypasses RLS edge cases during OAuth callback
create or replace function public.upsert_ebay_oauth_token(
  p_user_id uuid,
  p_access_token text,
  p_refresh_token text,
  p_access_token_expires_at timestamptz,
  p_refresh_token_expires_at timestamptz,
  p_scope text,
  p_token_type text,
  p_ebay_username text,
  p_raw_response jsonb,
  p_marketplace_id text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.ebay_oauth_tokens (
    user_id,
    access_token,
    refresh_token,
    access_token_expires_at,
    refresh_token_expires_at,
    scope,
    token_type,
    ebay_username,
    raw_response,
    marketplace_id
  )
  values (
    p_user_id,
    p_access_token,
    p_refresh_token,
    p_access_token_expires_at,
    p_refresh_token_expires_at,
    p_scope,
    p_token_type,
    p_ebay_username,
    p_raw_response,
    p_marketplace_id
  )
  on conflict (user_id) do update set
    access_token = excluded.access_token,
    refresh_token = excluded.refresh_token,
    access_token_expires_at = excluded.access_token_expires_at,
    refresh_token_expires_at = excluded.refresh_token_expires_at,
    scope = excluded.scope,
    token_type = excluded.token_type,
    ebay_username = coalesce(excluded.ebay_username, public.ebay_oauth_tokens.ebay_username),
    raw_response = excluded.raw_response,
    marketplace_id = coalesce(public.ebay_oauth_tokens.marketplace_id, excluded.marketplace_id);
end;
$$;

revoke all on function public.upsert_ebay_oauth_token(
  uuid, text, text, timestamptz, timestamptz, text, text, text, jsonb, text
) from public;

grant execute on function public.upsert_ebay_oauth_token(
  uuid, text, text, timestamptz, timestamptz, text, text, text, jsonb, text
) to service_role;
