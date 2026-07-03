-- Run in Supabase SQL Editor (Dashboard → SQL → New query)

create table if not exists public.transcriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  transcript text not null,
  summary text,
  source_filename text,
  language text,
  created_at timestamptz not null default now()
);

create index if not exists transcriptions_user_id_idx on public.transcriptions (user_id);
create index if not exists transcriptions_created_at_idx on public.transcriptions (created_at desc);

alter table public.transcriptions enable row level security;

create policy "Users read own transcriptions"
  on public.transcriptions for select
  using (auth.uid() = user_id);

create policy "Users insert own transcriptions"
  on public.transcriptions for insert
  with check (auth.uid() = user_id);

create policy "Users delete own transcriptions"
  on public.transcriptions for delete
  using (auth.uid() = user_id);
