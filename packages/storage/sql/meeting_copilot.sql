-- Run in Supabase SQL Editor
-- Meeting Copilot (Pitch Assist): knowledge pool + live Q&A turns

create table if not exists public.meeting_knowledge_docs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  doc_type text not null default 'note'
    check (doc_type in ('pitch', 'metrics', 'faq', 'strategy', 'product', 'competitor', 'note', 'answer-template')),
  tags text[] not null default '{}',
  content_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists meeting_knowledge_docs_user_idx
  on public.meeting_knowledge_docs (user_id, created_at desc);

create index if not exists meeting_knowledge_docs_tags_idx
  on public.meeting_knowledge_docs using gin (tags);

alter table public.meeting_knowledge_docs enable row level security;

drop policy if exists "Users read own meeting knowledge" on public.meeting_knowledge_docs;
create policy "Users read own meeting knowledge"
  on public.meeting_knowledge_docs for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own meeting knowledge" on public.meeting_knowledge_docs;
create policy "Users insert own meeting knowledge"
  on public.meeting_knowledge_docs for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update own meeting knowledge" on public.meeting_knowledge_docs;
create policy "Users update own meeting knowledge"
  on public.meeting_knowledge_docs for update
  using (auth.uid() = user_id);

drop policy if exists "Users delete own meeting knowledge" on public.meeting_knowledge_docs;
create policy "Users delete own meeting knowledge"
  on public.meeting_knowledge_docs for delete
  using (auth.uid() = user_id);

create table if not exists public.meeting_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  counterparty text not null default '',
  focus text not null default '',
  language_mode text not null default 'auto'
    check (language_mode in ('auto', 'tr', 'en')),
  tag_filter text[] not null default '{}',
  status text not null default 'active'
    check (status in ('active', 'ended')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists meeting_sessions_user_idx
  on public.meeting_sessions (user_id, started_at desc);

alter table public.meeting_sessions enable row level security;

drop policy if exists "Users read own meeting sessions" on public.meeting_sessions;
create policy "Users read own meeting sessions"
  on public.meeting_sessions for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own meeting sessions" on public.meeting_sessions;
create policy "Users insert own meeting sessions"
  on public.meeting_sessions for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update own meeting sessions" on public.meeting_sessions;
create policy "Users update own meeting sessions"
  on public.meeting_sessions for update
  using (auth.uid() = user_id);

drop policy if exists "Users delete own meeting sessions" on public.meeting_sessions;
create policy "Users delete own meeting sessions"
  on public.meeting_sessions for delete
  using (auth.uid() = user_id);

create table if not exists public.meeting_turns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.meeting_sessions(id) on delete cascade,
  question_text text not null default '',
  answer_json jsonb not null default '{}'::jsonb,
  detected_language text,
  latency_ms int,
  created_at timestamptz not null default now()
);

create index if not exists meeting_turns_session_idx
  on public.meeting_turns (session_id, created_at desc);

create index if not exists meeting_turns_user_idx
  on public.meeting_turns (user_id, created_at desc);

alter table public.meeting_turns enable row level security;

drop policy if exists "Users read own meeting turns" on public.meeting_turns;
create policy "Users read own meeting turns"
  on public.meeting_turns for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own meeting turns" on public.meeting_turns;
create policy "Users insert own meeting turns"
  on public.meeting_turns for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users delete own meeting turns" on public.meeting_turns;
create policy "Users delete own meeting turns"
  on public.meeting_turns for delete
  using (auth.uid() = user_id);

-- Chunked retrieval (also in meeting_copilot_v2_chunks.sql for existing projects)
-- Run meeting_copilot_v2_chunks.sql if upgrading an existing install.
