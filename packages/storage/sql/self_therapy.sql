-- Run in Supabase SQL Editor

create table if not exists public.self_therapy_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  topic text not null,
  locale text not null default 'tr',
  induction text not null default '',
  deepening text not null default '',
  suggestions text not null default '',
  full_script text not null default '',
  audio_path text,
  duration_seconds int,
  status text not null default 'draft'
    check (status in ('draft', 'ready', 'speaking', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists self_therapy_sessions_user_idx
  on public.self_therapy_sessions (user_id, created_at desc);

alter table public.self_therapy_sessions enable row level security;

drop policy if exists "Users read own self therapy" on public.self_therapy_sessions;
create policy "Users read own self therapy"
  on public.self_therapy_sessions for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own self therapy" on public.self_therapy_sessions;
create policy "Users insert own self therapy"
  on public.self_therapy_sessions for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update own self therapy" on public.self_therapy_sessions;
create policy "Users update own self therapy"
  on public.self_therapy_sessions for update
  using (auth.uid() = user_id);

drop policy if exists "Users delete own self therapy" on public.self_therapy_sessions;
create policy "Users delete own self therapy"
  on public.self_therapy_sessions for delete
  using (auth.uid() = user_id);
