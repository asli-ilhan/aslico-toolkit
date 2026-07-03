-- Run in Supabase SQL Editor

create table if not exists public.job_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company text not null,
  role text not null,
  job_description text,
  cv_profile text,
  cover_letter text,
  cv_suggestions text,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists job_applications_user_id_idx on public.job_applications (user_id);
create index if not exists job_applications_updated_at_idx on public.job_applications (updated_at desc);

alter table public.job_applications enable row level security;

create policy "Users read own job applications"
  on public.job_applications for select using (auth.uid() = user_id);

create policy "Users insert own job applications"
  on public.job_applications for insert with check (auth.uid() = user_id);

create policy "Users update own job applications"
  on public.job_applications for update using (auth.uid() = user_id);

create policy "Users delete own job applications"
  on public.job_applications for delete using (auth.uid() = user_id);
