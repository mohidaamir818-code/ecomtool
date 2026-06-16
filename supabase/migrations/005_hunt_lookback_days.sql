-- Run in Supabase SQL Editor after 004_hunt_products.sql
-- Safe to re-run

alter table public.hunt_requests
  add column if not exists lookback_days integer not null default 7;
