-- Funding Scout: global scholarships, fellowships, grants (manual scan — no cron required)

create table if not exists public.funding_scout_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  regions text[] not null default '{uk,eu,turkey,china,japan,gulf,americas,global}',
  funding_types text[] not null default '{phd_scholarship,fellowship,project_grant,travel_grant}',
  disciplines text[] not null default '{maritime,offshore,energy,renewable_energy,machine_learning,data_science,ai,engineering}',
  require_full_funding boolean not null default true,
  scan_depth text not null default 'normal' check (scan_depth in ('normal', 'deep')),
  citizenship text default 'TR',
  phd_stage text not null default 'starting' check (phd_stage in ('starting', 'in_progress', 'postdoc')),
  updated_at timestamptz not null default now()
);

create table if not exists public.funding_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  funder text not null,
  title text not null,
  funding_type text not null default 'phd_scholarship',
  region text not null default 'global',
  opportunity_url text,
  description text not null default '',
  deadline date,
  amount text,
  fit_score int,
  fit_reason text,
  motivation_letter text,
  research_summary text,
  project_outline text,
  notes text,
  status text not null default 'pending_review'
    check (status in ('pending_review', 'approved', 'submitted', 'skipped', 'rejected', 'awarded')),
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists funding_applications_user_status_idx
  on public.funding_applications (user_id, status, updated_at desc);

create table if not exists public.funding_scout_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  opportunities_scanned int not null default 0,
  packs_created int not null default 0,
  regions_scanned text[] not null default '{}',
  log jsonb default '[]'
);

alter table public.funding_scout_settings enable row level security;
alter table public.funding_applications enable row level security;
alter table public.funding_scout_runs enable row level security;

create policy "own funding_scout_settings" on public.funding_scout_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own funding_applications" on public.funding_applications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own funding_scout_runs" on public.funding_scout_runs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
