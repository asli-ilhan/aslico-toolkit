-- Scout scope feedback — user rejections teach future scans (run in Supabase SQL Editor)

create table if not exists public.scout_scope_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  module_id text not null check (module_id in ('funding-scout', 'job-agent')),
  action text not null check (action in ('dismiss', 'skip', 'reject', 'delete')),
  item_title text not null,
  item_subtitle text,
  item_url text,
  skip_category text,
  feedback text not null,
  created_at timestamptz not null default now()
);

create index if not exists scout_scope_feedback_user_module_idx
  on public.scout_scope_feedback (user_id, module_id, created_at desc);

alter table public.scout_scope_feedback enable row level security;

create policy "own scout_scope_feedback" on public.scout_scope_feedback
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Rolling summary injected into AI prompts during scans
alter table public.funding_scout_settings
  add column if not exists scope_learnings text not null default '';
