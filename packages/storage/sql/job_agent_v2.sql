-- Job Agent v2 — run in Supabase SQL Editor (replaces/extends job_applications.sql)

-- Master profile built from uploaded documents
create table if not exists public.candidate_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  master_profile jsonb not null default '{}',
  voice_samples jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

-- Uploaded CVs, cover letters, notes (extracted text)
create table if not exists public.candidate_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  filename text not null,
  doc_type text not null default 'cv',
  content_text text not null,
  created_at timestamptz not null default now()
);

create index if not exists candidate_documents_user_id_idx on public.candidate_documents (user_id);

-- Search preferences (domains, remote, gig platforms, etc.)
create table if not exists public.job_search_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferences jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- Application packs (morning inbox queue)
create table if not exists public.application_packs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company text not null,
  role text not null,
  job_url text,
  job_description text,
  remote_type text,
  employment_type text,
  fit_score real,
  fit_reason text,
  ai_risk_level text not null default 'low',
  ai_risk_reason text,
  tailored_cv text,
  cover_letter text,
  evidence_used jsonb default '[]',
  status text not null default 'pending_review',
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  submitted_at timestamptz
);

create index if not exists application_packs_user_status_idx on public.application_packs (user_id, status);
create index if not exists application_packs_updated_at_idx on public.application_packs (updated_at desc);

-- Nightly run log
create table if not exists public.job_agent_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  jobs_scanned int not null default 0,
  packs_created int not null default 0,
  log jsonb default '[]'
);

alter table public.candidate_profiles enable row level security;
alter table public.candidate_documents enable row level security;
alter table public.job_search_preferences enable row level security;
alter table public.application_packs enable row level security;
alter table public.job_agent_runs enable row level security;

create policy "own candidate_profiles" on public.candidate_profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own candidate_documents" on public.candidate_documents for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own job_search_preferences" on public.job_search_preferences for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own application_packs" on public.application_packs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own job_agent_runs" on public.job_agent_runs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
