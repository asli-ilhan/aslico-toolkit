-- Run after calendar_v2.sql if you already created calendar_connections with unique (user_id, provider)

alter table public.calendar_connections
  drop constraint if exists calendar_connections_user_id_provider_key;

create unique index if not exists calendar_connections_user_provider_email_idx
  on public.calendar_connections (user_id, provider, lower(account_email))
  where account_email is not null;

alter table public.calendar_events
  add column if not exists source_account text;
