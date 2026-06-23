-- Per-user Amazef connection (credential-verified, email-based listing intake)

create table if not exists public.amazef_connections (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  amazef_email text not null,
  amazef_user_id text,
  connected boolean not null default true,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists amazef_connections_user_id_idx
  on public.amazef_connections (user_id);

create or replace function public.set_amazef_connections_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_amazef_connections_updated_at on public.amazef_connections;
create trigger set_amazef_connections_updated_at
before update on public.amazef_connections
for each row
execute function public.set_amazef_connections_updated_at();

alter table public.amazef_connections enable row level security;

drop policy if exists "service role manages amazef connections" on public.amazef_connections;
create policy "service role manages amazef connections"
on public.amazef_connections
for all
to service_role
using (true)
with check (true);

-- Remember the seller's active listing destination. Existing sellers default to eBay
-- so their experience is unchanged.
alter table public.profiles
  add column if not exists active_listing_platform text not null default 'ebay';
