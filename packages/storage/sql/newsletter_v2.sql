-- Add custom news RSS feeds to newsletter settings

alter table public.newsletter_settings
  add column if not exists news_feeds text[] not null default '{}';
