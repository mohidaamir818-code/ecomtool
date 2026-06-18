-- Run in Supabase SQL Editor after 010_competitor_watches.sql
-- Safe to re-run

alter table public.competitor_watches
  add column if not exists platform text not null default 'amazef';
