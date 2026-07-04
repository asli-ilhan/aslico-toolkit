-- Funding Scout v2: eligibility profile + application eligibility fields
-- Run after funding_scout.sql in Supabase SQL Editor

alter table public.funding_scout_settings
  add column if not exists phd_start_month text not null default '2026-09',
  add column if not exists home_university text not null default '',
  add column if not exists home_country text not null default 'TR',
  add column if not exists partner_countries text[] not null default '{china,netherlands}',
  add column if not exists supervision_model text not null default 'co_supervision'
    check (supervision_model in ('standard', 'joint_phd', 'co_supervision', 'cotutelle')),
  add column if not exists partnership_notes text not null default '',
  add column if not exists strict_eligibility boolean not null default true;

alter table public.funding_applications
  add column if not exists eligibility_pass boolean,
  add column if not exists eligibility_reason text,
  add column if not exists eligibility_flags text[] not null default '{}';
