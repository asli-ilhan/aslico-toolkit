-- Job Agent v3 — run after job_agent_v2.sql in Supabase SQL Editor

-- Pack extras: notes, deadlines, funnel, email draft, variants
alter table public.application_packs add column if not exists notes text;
alter table public.application_packs add column if not exists deadline_at timestamptz;
alter table public.application_packs add column if not exists funnel_stage text not null default 'none';
alter table public.application_packs add column if not exists email_draft text;
alter table public.application_packs add column if not exists profile_variant text not null default 'default';
alter table public.application_packs add column if not exists follow_up_at timestamptz;
alter table public.application_packs add column if not exists domain_fit jsonb default '{}';
alter table public.application_packs add column if not exists auto_submit_blocked boolean not null default false;

-- Multi-profile variants (research / industry / gig)
alter table public.candidate_profiles add column if not exists profile_variants jsonb not null default '{}';

-- Job sources: URLs, RSS feeds, keyword alerts
create table if not exists public.job_watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'url',
  value text not null,
  label text,
  enabled boolean not null default true,
  last_checked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists job_watchlist_user_id_idx on public.job_watchlist (user_id);

-- Funnel analytics events
create table if not exists public.application_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pack_id uuid references public.application_packs(id) on delete cascade,
  event_type text not null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists application_events_user_id_idx on public.application_events (user_id);
create index if not exists application_events_pack_id_idx on public.application_events (pack_id);

alter table public.job_watchlist enable row level security;
alter table public.application_events enable row level security;

create policy "own job_watchlist" on public.job_watchlist for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own application_events" on public.application_events for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
