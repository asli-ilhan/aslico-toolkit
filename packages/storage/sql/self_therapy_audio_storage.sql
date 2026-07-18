-- Run in Supabase SQL Editor
-- Audio for Self Therapy sleep sessions (bypasses Vercel body limits).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'self-therapy-audio',
  'self-therapy-audio',
  false,
  52428800,
  null
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = null;

drop policy if exists "Users upload own self therapy audio" on storage.objects;
create policy "Users upload own self therapy audio"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'self-therapy-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users read own self therapy audio" on storage.objects;
create policy "Users read own self therapy audio"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'self-therapy-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users delete own self therapy audio" on storage.objects;
create policy "Users delete own self therapy audio"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'self-therapy-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
