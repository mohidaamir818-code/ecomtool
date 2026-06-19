-- Per-platform daily quotas and overflow request queue

create table if not exists public.user_quotas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null check (platform in ('ebay', 'aliexpress', 'amazef')),
  daily_limit int,
  used_today int not null default 0,
  total_used bigint not null default 0,
  last_reset_at timestamptz not null default now(),
  updated_by text,
  updated_at timestamptz not null default now(),
  unique (user_id, platform)
);

create index if not exists user_quotas_user_platform_idx
  on public.user_quotas (user_id, platform);

alter table public.user_quotas enable row level security;

drop policy if exists "Service role full access on user_quotas" on public.user_quotas;
create policy "Service role full access on user_quotas"
  on public.user_quotas for all
  using (auth.role() = 'service_role');

create table if not exists public.request_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null check (platform in ('ebay', 'aliexpress')),
  item_ids uuid[] not null default '{}',
  scheduled_for date not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed')),
  processed_count int not null default 0,
  total_count int not null default 0,
  progress_message text,
  created_at timestamptz not null default now()
);

create index if not exists request_queue_user_platform_idx
  on public.request_queue (user_id, platform, scheduled_for, status);

alter table public.request_queue enable row level security;

drop policy if exists "Service role full access on request_queue" on public.request_queue;
create policy "Service role full access on request_queue"
  on public.request_queue for all
  using (auth.role() = 'service_role');

create or replace function public.get_user_quotas(p_user_id uuid)
returns table (
  platform text,
  daily_limit int,
  used_today int,
  total_used bigint,
  remaining int,
  last_reset_at timestamptz,
  updated_by text,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    q.platform,
    q.daily_limit,
    q.used_today,
    q.total_used,
    case
      when q.daily_limit is null then null
      else greatest(q.daily_limit - q.used_today, 0)
    end as remaining,
    q.last_reset_at,
    q.updated_by,
    q.updated_at
  from public.user_quotas q
  where q.user_id = p_user_id
  order by
    case q.platform
      when 'amazef' then 1
      when 'ebay' then 2
      when 'aliexpress' then 3
    end;
$$;
