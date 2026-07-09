-- Run in Supabase SQL Editor after 026_fix_ebay_oauth_tokens_rls.sql
-- Safe to re-run

alter table public.competitor_watches
  add column if not exists listing_url text,
  add column if not exists watched_variants_json jsonb;
