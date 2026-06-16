-- Run in Supabase SQL Editor after 002_onboarding_fields.sql
-- Safe to re-run

alter table public.profiles
  add column if not exists email_verified boolean not null default false;

create table if not exists public.email_otps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  otp_code text not null,
  expires_at timestamptz not null,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists email_otps_user_id_idx on public.email_otps (user_id);

alter table public.email_otps enable row level security;

drop policy if exists "Service role full access on email_otps" on public.email_otps;
create policy "Service role full access on email_otps"
  on public.email_otps for all
  using (auth.role() = 'service_role');
