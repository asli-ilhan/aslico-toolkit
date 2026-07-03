-- Run in Supabase SQL Editor after calendar.sql

create table if not exists public.culture_tracker_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  home_cities text[] not null default '{}',
  interests text[] not null default '{}',
  book_topics text[] not null default '{}',
  favorite_authors text[] not null default '{}',
  spotify_artists text[] not null default '{}',
  languages text[] not null default '{en,tr}',
  updated_at timestamptz not null default now()
);

create table if not exists public.culture_tracker_books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  author text,
  language text not null default 'en',
  category text not null default 'development',
  status text not null default 'want_to_read' check (status in ('want_to_read', 'reading', 'read', 'skipped')),
  priority int not null default 0,
  source text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists culture_tracker_books_user_status_idx
  on public.culture_tracker_books (user_id, status, priority desc);

create table if not exists public.culture_tracker_scouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scout_date date not null default (timezone('utc', now()))::date,
  title text not null,
  sections jsonb not null default '{}',
  content_md text not null default '',
  created_at timestamptz not null default now()
);

create unique index if not exists culture_tracker_scouts_user_date_idx
  on public.culture_tracker_scouts (user_id, scout_date);

alter table public.culture_tracker_settings enable row level security;
alter table public.culture_tracker_books enable row level security;
alter table public.culture_tracker_scouts enable row level security;

create policy "Users read own culture settings"
  on public.culture_tracker_settings for select using (auth.uid() = user_id);
create policy "Users upsert own culture settings"
  on public.culture_tracker_settings for insert with check (auth.uid() = user_id);
create policy "Users update own culture settings"
  on public.culture_tracker_settings for update using (auth.uid() = user_id);

create policy "Users read own culture books"
  on public.culture_tracker_books for select using (auth.uid() = user_id);
create policy "Users insert own culture books"
  on public.culture_tracker_books for insert with check (auth.uid() = user_id);
create policy "Users update own culture books"
  on public.culture_tracker_books for update using (auth.uid() = user_id);
create policy "Users delete own culture books"
  on public.culture_tracker_books for delete using (auth.uid() = user_id);

create policy "Users read own culture scouts"
  on public.culture_tracker_scouts for select using (auth.uid() = user_id);
create policy "Users insert own culture scouts"
  on public.culture_tracker_scouts for insert with check (auth.uid() = user_id);
create policy "Users update own culture scouts"
  on public.culture_tracker_scouts for update using (auth.uid() = user_id);
