-- Run in Supabase SQL Editor after calendar.sql

create table if not exists public.calendar_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('google', 'microsoft')),
  account_email text,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  calendar_id text default 'primary',
  updated_at timestamptz not null default now()
);

create unique index if not exists calendar_connections_user_provider_email_idx
  on public.calendar_connections (user_id, provider, lower(account_email))
  where account_email is not null;

create table if not exists public.calendar_todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  due_date date not null,
  title text not null,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists calendar_todos_user_date_idx
  on public.calendar_todos (user_id, due_date);

create unique index if not exists calendar_events_user_source_ref_idx
  on public.calendar_events (user_id, source, source_ref)
  where source_ref is not null;

alter table public.calendar_connections enable row level security;
alter table public.calendar_todos enable row level security;

create policy "Users read own calendar connections"
  on public.calendar_connections for select
  using (auth.uid() = user_id);

create policy "Users insert own calendar connections"
  on public.calendar_connections for insert
  with check (auth.uid() = user_id);

create policy "Users update own calendar connections"
  on public.calendar_connections for update
  using (auth.uid() = user_id);

create policy "Users delete own calendar connections"
  on public.calendar_connections for delete
  using (auth.uid() = user_id);

create policy "Users read own calendar todos"
  on public.calendar_todos for select
  using (auth.uid() = user_id);

create policy "Users insert own calendar todos"
  on public.calendar_todos for insert
  with check (auth.uid() = user_id);

create policy "Users update own calendar todos"
  on public.calendar_todos for update
  using (auth.uid() = user_id);

create policy "Users delete own calendar todos"
  on public.calendar_todos for delete
  using (auth.uid() = user_id);
