-- Skipped scout candidates — review and optionally generate packs manually

create table if not exists public.scout_skipped_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  module_id text not null check (module_id in ('funding-scout', 'job-agent')),
  run_id uuid,
  title text not null,
  subtitle text,
  item_url text,
  description text,
  skip_reason text not null,
  skip_category text not null,
  fit_score int,
  candidate_data jsonb not null default '{}',
  promoted_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists scout_skipped_user_module_idx
  on public.scout_skipped_items (user_id, module_id, created_at desc)
  where dismissed_at is null;

alter table public.scout_skipped_items enable row level security;

create policy "own scout_skipped_items" on public.scout_skipped_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
