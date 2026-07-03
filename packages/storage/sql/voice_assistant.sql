-- Run in Supabase SQL Editor (Dashboard → SQL → New query)

create table if not exists public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists assistant_messages_user_created_idx
  on public.assistant_messages (user_id, created_at desc);

alter table public.assistant_messages enable row level security;

create policy "Users read own assistant messages"
  on public.assistant_messages for select
  using (auth.uid() = user_id);

create policy "Users insert own assistant messages"
  on public.assistant_messages for insert
  with check (auth.uid() = user_id);

create policy "Users delete own assistant messages"
  on public.assistant_messages for delete
  using (auth.uid() = user_id);
