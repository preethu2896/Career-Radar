-- Apply in Supabase before enabling resume uploads. No public read access.
create table if not exists public.candidate_resumes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  file_size bigint not null check (file_size > 0 and file_size <= 5242880),
  consent_version text not null,
  consented_at timestamptz not null,
  updated_at timestamptz not null default now(),
  check (split_part(storage_path, '/', 1) = user_id::text)
);
alter table public.candidate_resumes enable row level security;
create policy "resume metadata owner only" on public.candidate_resumes
for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.candidate_resumes to authenticated;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('candidate-resumes', 'candidate-resumes', false, 5242880, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = array['application/pdf'];
create policy "resume objects owner select" on storage.objects for select to authenticated
using (bucket_id = 'candidate-resumes' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "resume objects owner insert" on storage.objects for insert to authenticated
with check (bucket_id = 'candidate-resumes' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "resume objects owner delete" on storage.objects for delete to authenticated
using (bucket_id = 'candidate-resumes' and (storage.foldername(name))[1] = (select auth.uid())::text);
