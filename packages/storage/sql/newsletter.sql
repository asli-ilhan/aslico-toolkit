-- Run in Supabase SQL Editor (Dashboard → SQL → New query)

create table if not exists public.newsletter_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  interests text[] not null default '{}',
  delivery_time time not null default '08:00',
  timezone text not null default 'Europe/Istanbul',
  updated_at timestamptz not null default now()
);

create table if not exists public.newsletter_issues (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  issue_date date not null,
  title text not null,
  content_md text not null,
  sections jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (user_id, issue_date)
);

create index if not exists newsletter_issues_user_date_idx
  on public.newsletter_issues (user_id, issue_date desc);

alter table public.newsletter_settings enable row level security;
alter table public.newsletter_issues enable row level security;

create policy "Users read own newsletter settings"
  on public.newsletter_settings for select
  using (auth.uid() = user_id);

create policy "Users upsert own newsletter settings"
  on public.newsletter_settings for insert
  with check (auth.uid() = user_id);

create policy "Users update own newsletter settings"
  on public.newsletter_settings for update
  using (auth.uid() = user_id);

create policy "Users read own newsletter issues"
  on public.newsletter_issues for select
  using (auth.uid() = user_id);

create policy "Users insert own newsletter issues"
  on public.newsletter_issues for insert
  with check (auth.uid() = user_id);

create policy "Users delete own newsletter issues"
  on public.newsletter_issues for delete
  using (auth.uid() = user_id);
