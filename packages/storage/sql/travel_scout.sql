-- Run in Supabase SQL Editor

create table if not exists public.travel_scout_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferred_vibes text[] not null default '{offbeat,authentic,high-society}',
  interests text[] not null default '{}',
  avoid_mass_tourism boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.travel_scout_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  destination text not null,
  start_date date,
  end_date date,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists travel_scout_plans_user_idx
  on public.travel_scout_plans (user_id, start_date);

create table if not exists public.travel_scout_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  destination text not null,
  report_key text not null,
  title text not null,
  sections jsonb not null default '{}',
  content_md text not null default '',
  plan_id uuid references public.travel_scout_plans(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists travel_scout_reports_user_key_idx
  on public.travel_scout_reports (user_id, report_key);

alter table public.travel_scout_settings enable row level security;
alter table public.travel_scout_plans enable row level security;
alter table public.travel_scout_reports enable row level security;

create policy "Users read own travel settings" on public.travel_scout_settings for select using (auth.uid() = user_id);
create policy "Users insert own travel settings" on public.travel_scout_settings for insert with check (auth.uid() = user_id);
create policy "Users update own travel settings" on public.travel_scout_settings for update using (auth.uid() = user_id);

create policy "Users read own travel plans" on public.travel_scout_plans for select using (auth.uid() = user_id);
create policy "Users insert own travel plans" on public.travel_scout_plans for insert with check (auth.uid() = user_id);
create policy "Users delete own travel plans" on public.travel_scout_plans for delete using (auth.uid() = user_id);

create policy "Users read own travel reports" on public.travel_scout_reports for select using (auth.uid() = user_id);
create policy "Users insert own travel reports" on public.travel_scout_reports for insert with check (auth.uid() = user_id);
