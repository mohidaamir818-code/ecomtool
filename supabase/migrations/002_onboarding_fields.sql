-- Run this in Supabase SQL Editor after 001_profiles.sql
-- Safe to re-run

alter table public.profiles
  add column if not exists heard_about_us text,
  add column if not exists platform text,
  add column if not exists supplier text not null default 'AliExpress',
  add column if not exists onboarding_completed boolean not null default false;

-- Backfill supplier for existing rows
update public.profiles
set supplier = 'AliExpress'
where supplier is null or supplier = '';
