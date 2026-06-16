-- Run this in your Supabase SQL Editor (Dashboard → SQL → New query)
-- Safe to re-run: uses IF NOT EXISTS / DROP IF EXISTS

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null unique,
  phone text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Service role full access" on public.profiles;
create policy "Service role full access"
  on public.profiles for all
  using (auth.role() = 'service_role');

create index if not exists profiles_email_idx on public.profiles (email);
