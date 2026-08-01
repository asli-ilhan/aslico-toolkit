-- Run in Supabase SQL Editor after meeting_copilot.sql
-- Chunked knowledge + hybrid FTS/trigram retrieval for Meeting Copilot

create extension if not exists pg_trgm;

create table if not exists public.meeting_knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid not null references public.meeting_knowledge_docs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  chunk_index int not null default 0,
  content_text text not null default '',
  tsv tsvector generated always as (to_tsvector('simple', coalesce(content_text, ''))) stored,
  created_at timestamptz not null default now(),
  unique (doc_id, chunk_index)
);

create index if not exists meeting_knowledge_chunks_user_idx
  on public.meeting_knowledge_chunks (user_id);

create index if not exists meeting_knowledge_chunks_doc_idx
  on public.meeting_knowledge_chunks (doc_id, chunk_index);

create index if not exists meeting_knowledge_chunks_tsv_idx
  on public.meeting_knowledge_chunks using gin (tsv);

create index if not exists meeting_knowledge_chunks_trgm_idx
  on public.meeting_knowledge_chunks using gin (content_text gin_trgm_ops);

alter table public.meeting_knowledge_chunks enable row level security;

drop policy if exists "Users read own meeting chunks" on public.meeting_knowledge_chunks;
create policy "Users read own meeting chunks"
  on public.meeting_knowledge_chunks for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own meeting chunks" on public.meeting_knowledge_chunks;
create policy "Users insert own meeting chunks"
  on public.meeting_knowledge_chunks for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update own meeting chunks" on public.meeting_knowledge_chunks;
create policy "Users update own meeting chunks"
  on public.meeting_knowledge_chunks for update
  using (auth.uid() = user_id);

drop policy if exists "Users delete own meeting chunks" on public.meeting_knowledge_chunks;
create policy "Users delete own meeting chunks"
  on public.meeting_knowledge_chunks for delete
  using (auth.uid() = user_id);

-- Hybrid search: FTS + trigram. Tag filter is STRICT (empty when no overlap).
create or replace function public.search_meeting_knowledge(
  p_user_id uuid,
  p_query text,
  p_tags text[] default '{}',
  p_limit int default 8
)
returns table (
  chunk_id uuid,
  doc_id uuid,
  title text,
  doc_type text,
  content_text text,
  score double precision
)
language sql
stable
security invoker
as $$
  with q as (
    select
      nullif(trim(p_query), '') as query_text,
      websearch_to_tsquery('simple', coalesce(nullif(trim(p_query), ''), 'empty')) as tsq
  ),
  ranked as (
    select
      c.id as chunk_id,
      c.doc_id,
      d.title,
      d.doc_type,
      c.content_text,
      (
        coalesce(ts_rank_cd(c.tsv, q.tsq), 0) * 2.2
        + coalesce(similarity(c.content_text, q.query_text), 0) * 1.4
        + case
            when q.query_text is not null and c.content_text ilike '%' || q.query_text || '%' then 0.35
            else 0
          end
      )::double precision as score
    from public.meeting_knowledge_chunks c
    join public.meeting_knowledge_docs d on d.id = c.doc_id
    cross join q
    where c.user_id = p_user_id
      and d.user_id = p_user_id
      and (
        cardinality(coalesce(p_tags, '{}')) = 0
        or d.tags && p_tags
      )
      and (
        q.query_text is null
        or c.tsv @@ q.tsq
        or c.content_text % q.query_text
        or c.content_text ilike '%' || left(q.query_text, 80) || '%'
      )
  )
  select *
  from ranked
  where score > 0 or cardinality(coalesce(p_tags, '{}')) > 0
  order by score desc, title asc
  limit greatest(1, least(coalesce(p_limit, 8), 24));
$$;

grant execute on function public.search_meeting_knowledge(uuid, text, text[], int) to authenticated;
grant execute on function public.search_meeting_knowledge(uuid, text, text[], int) to service_role;
