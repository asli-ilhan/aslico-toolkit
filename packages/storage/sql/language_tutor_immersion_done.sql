-- Optional: immersion watch/read progress for Language Tutor
-- Run in Supabase SQL Editor if immersion mark-done fails to persist.

alter table public.language_tutor_settings
  add column if not exists immersion_done jsonb not null default '{}'::jsonb;
