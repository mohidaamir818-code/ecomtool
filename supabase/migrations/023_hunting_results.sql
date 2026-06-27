-- Hunting results received from the HuntPro Chrome extension

create table if not exists public.hunting_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  keyword text not null,
  source text not null default 'huntpro-extension',
  statistics jsonb not null default '{}'::jsonb,
  products jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists hunting_results_user_id_idx on public.hunting_results (user_id);
create index if not exists hunting_results_user_keyword_idx on public.hunting_results (user_id, keyword);
create index if not exists hunting_results_created_at_idx on public.hunting_results (created_at desc);

alter table public.hunting_results enable row level security;

drop policy if exists "Service role full access on hunting_results" on public.hunting_results;
create policy "Service role full access on hunting_results"
  on public.hunting_results for all
  using (auth.role() = 'service_role');
