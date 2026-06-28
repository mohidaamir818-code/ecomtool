-- Help Center: support tickets, threaded messages, and attachment storage.

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  subject text not null default 'Support request',
  status text not null default 'open' check (status in ('open', 'answered', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  sender text not null check (sender in ('user', 'admin')),
  body text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists support_tickets_user_id_idx on public.support_tickets (user_id);
create index if not exists support_tickets_status_idx on public.support_tickets (status);
create index if not exists support_tickets_last_message_idx on public.support_tickets (last_message_at desc);
create index if not exists support_messages_ticket_idx on public.support_messages (ticket_id, created_at);

alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;

drop policy if exists "Service role full access on support_tickets" on public.support_tickets;
create policy "Service role full access on support_tickets"
  on public.support_tickets for all
  using (auth.role() = 'service_role');

drop policy if exists "Service role full access on support_messages" on public.support_messages;
create policy "Service role full access on support_messages"
  on public.support_messages for all
  using (auth.role() = 'service_role');

-- Public storage bucket for support attachments (photos / videos).
-- Uploads happen with the service role; public read lets the stored URLs render.
insert into storage.buckets (id, name, public)
values ('support-attachments', 'support-attachments', true)
on conflict (id) do nothing;

drop policy if exists "Public read support attachments" on storage.objects;
create policy "Public read support attachments"
  on storage.objects for select
  using (bucket_id = 'support-attachments');
