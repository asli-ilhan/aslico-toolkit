-- Run in Supabase SQL Editor

create table if not exists public.language_tutor_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  program_start_date date not null default (timezone('utc', now()))::date,
  goal_days int not null default 90,
  rotation text[] not null default '{fr,es,ar}',
  sunday_break boolean not null default false,
  native_language text not null default 'tr',
  level text not null default 'beginner',
  updated_at timestamptz not null default now()
);

create table if not exists public.language_tutor_lessons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_date date not null,
  language text not null check (language in ('fr', 'es', 'ar')),
  program_day int not null default 1,
  topic text not null,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'done', 'skipped')),
  sections jsonb not null default '{}',
  scores jsonb,
  youtube_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists language_tutor_lessons_user_date_idx
  on public.language_tutor_lessons (user_id, lesson_date);

create table if not exists public.language_tutor_flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  language text not null check (language in ('fr', 'es', 'ar')),
  word text not null,
  translation text not null,
  ipa text,
  example_sentence text,
  synonyms text,
  antonyms text,
  ease_factor numeric not null default 2.5,
  interval_days int not null default 0,
  repetitions int not null default 0,
  next_review_at date not null default (timezone('utc', now()))::date,
  source_lesson_id uuid references public.language_tutor_lessons(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists language_tutor_flashcards_review_idx
  on public.language_tutor_flashcards (user_id, language, next_review_at);

create table if not exists public.language_tutor_errors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  language text not null check (language in ('fr', 'es', 'ar')),
  mistake text not null,
  correction text not null,
  explanation text,
  natural_variant text,
  count int not null default 1,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists language_tutor_errors_user_lang_mistake_idx
  on public.language_tutor_errors (user_id, language, lower(mistake));

create table if not exists public.language_tutor_chat (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  language text not null check (language in ('fr', 'es', 'ar')),
  mode text not null check (mode in ('friend', 'pronunciation', 'voice_coach', 'grammar')),
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists language_tutor_chat_user_mode_idx
  on public.language_tutor_chat (user_id, language, mode, created_at desc);

create table if not exists public.language_tutor_grammar_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  language text not null check (language in ('fr', 'es', 'ar')),
  topic_id text not null,
  mastery_score int not null default 0,
  passed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, language, topic_id)
);

create table if not exists public.language_tutor_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  content_md text not null,
  sections jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create unique index if not exists language_tutor_reports_user_week_idx
  on public.language_tutor_reports (user_id, week_start);

alter table public.language_tutor_settings enable row level security;
alter table public.language_tutor_lessons enable row level security;
alter table public.language_tutor_flashcards enable row level security;
alter table public.language_tutor_errors enable row level security;
alter table public.language_tutor_chat enable row level security;
alter table public.language_tutor_grammar_progress enable row level security;
alter table public.language_tutor_reports enable row level security;

create policy "lt settings select" on public.language_tutor_settings for select using (auth.uid() = user_id);
create policy "lt settings insert" on public.language_tutor_settings for insert with check (auth.uid() = user_id);
create policy "lt settings update" on public.language_tutor_settings for update using (auth.uid() = user_id);

create policy "lt lessons all" on public.language_tutor_lessons for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "lt flashcards all" on public.language_tutor_flashcards for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "lt errors all" on public.language_tutor_errors for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "lt chat all" on public.language_tutor_chat for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "lt grammar all" on public.language_tutor_grammar_progress for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "lt reports all" on public.language_tutor_reports for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
