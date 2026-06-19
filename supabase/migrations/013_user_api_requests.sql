-- Track every billable / user API request for admin analytics

create table if not exists public.user_api_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null,
  method text not null default 'POST',
  status text not null check (status in ('success', 'failed')),
  created_at timestamptz not null default now()
);

create index if not exists user_api_requests_user_id_idx
  on public.user_api_requests (user_id);

create index if not exists user_api_requests_created_at_idx
  on public.user_api_requests (created_at desc);

create index if not exists user_api_requests_user_created_idx
  on public.user_api_requests (user_id, created_at desc);

alter table public.user_api_requests enable row level security;

drop policy if exists "Service role full access on user_api_requests" on public.user_api_requests;
create policy "Service role full access on user_api_requests"
  on public.user_api_requests for all
  using (auth.role() = 'service_role');

-- Backfill historical activity from existing tables
insert into public.user_api_requests (user_id, endpoint, method, status, created_at)
select
  user_id,
  '/api/hunt/amazef',
  'POST',
  case when lower(status) = 'failed' then 'failed' else 'success' end,
  created_at
from public.hunt_requests;

insert into public.user_api_requests (user_id, endpoint, method, status, created_at)
select user_id, '/api/competitors/check', 'POST', 'success', created_at
from public.competitor_checks;

-- Aggregated stats helper for admin list
create or replace function public.admin_user_request_stats()
returns table (
  user_id uuid,
  total_requests bigint,
  today_requests bigint,
  last_active timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.user_id,
    count(*)::bigint as total_requests,
    count(*) filter (
      where r.created_at >= date_trunc('day', now() at time zone 'utc')
    )::bigint as today_requests,
    max(r.created_at) as last_active
  from public.user_api_requests r
  group by r.user_id;
$$;

-- Daily request counts for charts (last N days)
create or replace function public.admin_user_daily_requests(p_user_id uuid, p_days int default 30)
returns table (day date, request_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  with days as (
    select generate_series(
      (current_date - (p_days - 1)),
      current_date,
      interval '1 day'
    )::date as day
  )
  select
    d.day,
    coalesce(count(r.id), 0)::bigint as request_count
  from days d
  left join public.user_api_requests r
    on r.user_id = p_user_id
   and r.created_at >= d.day
   and r.created_at < d.day + interval '1 day'
  group by d.day
  order by d.day;
$$;
