-- User account blocking (admin-controlled)

alter table public.profiles
  add column if not exists is_blocked boolean not null default false,
  add column if not exists blocked_reason text,
  add column if not exists blocked_at timestamptz,
  add column if not exists blocked_by text;

create index if not exists profiles_is_blocked_idx
  on public.profiles (is_blocked)
  where is_blocked = true;
