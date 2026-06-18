-- Run in Supabase SQL Editor after 008_aliexpress_oauth_tokens.sql
-- Safe to re-run

alter table public.handling_products
  add column if not exists variants_json jsonb,
  add column if not exists selected_variant_id text;
