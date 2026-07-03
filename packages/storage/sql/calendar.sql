-- Run in Supabase SQL Editor (Dashboard → SQL → New query)

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  source text not null default 'manual',
  source_ref text,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists calendar_events_user_starts_idx
  on public.calendar_events (user_id, starts_at);

alter table public.calendar_events enable row level security;

create policy "Users read own calendar events"
  on public.calendar_events for select
  using (auth.uid() = user_id);

create policy "Users insert own calendar events"
  on public.calendar_events for insert
  with check (auth.uid() = user_id);

create policy "Users update own calendar events"
  on public.calendar_events for update
  using (auth.uid() = user_id);

create policy "Users delete own calendar events"
  on public.calendar_events for delete
  using (auth.uid() = user_id);
