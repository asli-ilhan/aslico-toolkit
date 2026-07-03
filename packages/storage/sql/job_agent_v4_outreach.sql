-- Job Agent v4 — outreach + Gmail (run after job_agent_v3.sql)

create table if not exists public.gmail_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  scopes text not null default 'gmail.send',
  updated_at timestamptz not null default now()
);

create table if not exists public.outreach_campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pack_id uuid not null references public.application_packs(id) on delete cascade,
  status text not null default 'discovering',
  subject text,
  body text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (pack_id)
);

create index if not exists outreach_campaigns_user_status_idx
  on public.outreach_campaigns (user_id, status);

create table if not exists public.outreach_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.outreach_campaigns(id) on delete cascade,
  name text,
  title text,
  email text not null,
  source text not null default 'discovered',
  relevance_score real,
  selected boolean not null default true,
  sent_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists outreach_recipients_campaign_id_idx
  on public.outreach_recipients (campaign_id);

alter table public.gmail_connections enable row level security;
alter table public.outreach_campaigns enable row level security;
alter table public.outreach_recipients enable row level security;

create policy "own gmail_connections"
  on public.gmail_connections for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own outreach_campaigns"
  on public.outreach_campaigns for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own outreach_recipients"
  on public.outreach_recipients for all
  using (
    exists (
      select 1 from public.outreach_campaigns c
      where c.id = campaign_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.outreach_campaigns c
      where c.id = campaign_id and c.user_id = auth.uid()
    )
  );
