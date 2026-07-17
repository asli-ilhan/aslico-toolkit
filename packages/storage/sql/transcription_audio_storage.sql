-- Run in Supabase SQL Editor (Dashboard → SQL → New query)
-- Large audio uploads bypass Vercel’s ~4.5 MB request body limit via Storage.
-- Re-run safe: clears MIME whitelist (m4a browsers often send empty/odd content-types).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'transcription-audio',
  'transcription-audio',
  false,
  26214400,
  null
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = null;

drop policy if exists "Users upload own transcription audio" on storage.objects;
create policy "Users upload own transcription audio"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'transcription-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users read own transcription audio" on storage.objects;
create policy "Users read own transcription audio"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'transcription-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users delete own transcription audio" on storage.objects;
create policy "Users delete own transcription audio"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'transcription-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
