-- Run in Supabase SQL Editor after 011_competitor_watch_platform.sql
-- Safe to re-run

alter table public.competitor_watch_matches
  add column if not exists seller_name text,
  add column if not exists variants_json jsonb;
