-- Enable Sunday lessons by default (optional rest day remains a UI toggle).
-- Run in Supabase SQL Editor.

alter table public.language_tutor_settings
  alter column sunday_break set default false;

update public.language_tutor_settings
set sunday_break = false,
    updated_at = now()
where sunday_break = true;
