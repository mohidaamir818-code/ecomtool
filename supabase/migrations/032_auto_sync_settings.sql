-- Auto-sync preferences for marketplace stock/price updates (handling checks).
-- Defaults: sync OFF, email notifications ON.

create table if not exists public.auto_sync_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  auto_sync_stock boolean not null default false,
  auto_sync_price boolean not null default false,
  auto_sync_notify boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.auto_sync_settings enable row level security;

drop policy if exists "Service role full access on auto_sync_settings" on public.auto_sync_settings;
create policy "Service role full access on auto_sync_settings"
  on public.auto_sync_settings for all
  using (auth.role() = 'service_role');
