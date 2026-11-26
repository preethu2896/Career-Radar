-- Deploy manage-resume and configure its origins before rolling out the new client.
-- Existing PDFs remain private and readable. All mutations now go through the
-- authenticated Edge Function. Never delete storage.objects directly in SQL.
begin;

update storage.buckets set public = false, file_size_limit = 5242880,
  allowed_mime_types = array['application/pdf'] where id = 'candidate-resumes';

drop policy if exists "resume metadata owner only" on public.candidate_resumes;
create policy "resume metadata owner read" on public.candidate_resumes
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "resume metadata reads remain owner scoped" on public.candidate_resumes as restrictive
  for select to anon, authenticated using ((select auth.uid()) = user_id);
revoke insert, update, delete on public.candidate_resumes from anon, authenticated;
grant select on public.candidate_resumes to authenticated;
grant all on public.candidate_resumes to service_role;

drop policy if exists "resume objects owner insert" on storage.objects;
drop policy if exists "resume objects owner delete" on storage.objects;
-- Restrictive policies also guard against unrelated broad permissive policies.
create policy "resume inserts require backend" on storage.objects as restrictive
  for insert to anon, authenticated with check (bucket_id <> 'candidate-resumes');
create policy "resume updates require backend" on storage.objects as restrictive
  for update to anon, authenticated using (bucket_id <> 'candidate-resumes') with check (bucket_id <> 'candidate-resumes');
create policy "resume deletes require backend" on storage.objects as restrictive
  for delete to anon, authenticated using (bucket_id <> 'candidate-resumes');
create policy "resume reads remain owner scoped" on storage.objects as restrictive
  for select to anon, authenticated using (bucket_id <> 'candidate-resumes' or
    (storage.foldername(name))[1] = (select auth.uid())::text);

create table public.resume_operation_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  lease uuid,
  leased_until timestamptz,
  upload_window timestamptz not null default now(),
  uploads integer not null default 0 check (uploads between 0 and 5)
);
alter table public.resume_operation_limits enable row level security;
revoke all on public.resume_operation_limits from public, anon, authenticated;
grant all on public.resume_operation_limits to service_role;

create function public.begin_resume_operation(p_user_id uuid, p_action text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare limits public.resume_operation_limits; token uuid;
begin
  if p_action not in ('upload', 'remove') or p_action is null then raise exception 'INVALID_ACTION'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('resume:' || p_user_id::text, 0));
  insert into public.resume_operation_limits(user_id) values(p_user_id) on conflict do nothing;
  select * into limits from public.resume_operation_limits where user_id = p_user_id for update;
  if limits.leased_until > now() then raise exception 'RESUME_BUSY'; end if;
  if limits.upload_window <= now() - interval '1 hour' then
    limits.upload_window := now(); limits.uploads := 0;
  end if;
  if p_action = 'upload' and limits.uploads >= 5 then raise exception 'RESUME_RATE_LIMIT'; end if;
  token := gen_random_uuid();
  update public.resume_operation_limits set lease = token,
    leased_until = now() + interval '15 minutes', upload_window = limits.upload_window,
    uploads = limits.uploads + case when p_action = 'upload' then 1 else 0 end
    where user_id = p_user_id;
  return token;
end;
$$;

create function public.commit_resume_operation(p_user_id uuid, p_lease uuid, p_record jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.resume_operation_limits where user_id = p_user_id
    and lease = p_lease and leased_until > now() for update;
  if not found then raise exception 'STALE_RESUME_OPERATION'; end if;
  if p_record is null then
    delete from public.candidate_resumes where user_id = p_user_id;
    -- Keep legacy profile metadata consistent without deleting extracted fields.
    update public.profiles set resume_name = null, resume_bytes = null where id = p_user_id;
  else
    if (p_record->>'user_id')::uuid is distinct from p_user_id
      or split_part(p_record->>'storage_path', '/', 1) is distinct from p_user_id::text
      or length(p_record->>'file_name') not between 1 and 200
      then raise exception 'INVALID_RESUME_RECORD'; end if;
    insert into public.candidate_resumes(user_id, storage_path, file_name, file_size, consent_version, consented_at, updated_at)
    values(p_user_id, p_record->>'storage_path', p_record->>'file_name', (p_record->>'file_size')::bigint,
      p_record->>'consent_version', now(), now())
    on conflict(user_id) do update set storage_path = excluded.storage_path, file_name = excluded.file_name,
      file_size = excluded.file_size, consent_version = excluded.consent_version, consented_at = excluded.consented_at, updated_at = excluded.updated_at;
  end if;
end;
$$;

create function public.finish_resume_operation(p_user_id uuid, p_lease uuid)
returns void language sql security definer set search_path = '' as $$
  update public.resume_operation_limits set lease = null, leased_until = null
  where user_id = p_user_id and lease = p_lease;
$$;

revoke all on function public.begin_resume_operation(uuid,text) from public, anon, authenticated;
revoke all on function public.commit_resume_operation(uuid,uuid,jsonb) from public, anon, authenticated;
revoke all on function public.finish_resume_operation(uuid,uuid) from public, anon, authenticated;
grant execute on function public.begin_resume_operation(uuid,text) to service_role;
grant execute on function public.commit_resume_operation(uuid,uuid,jsonb) to service_role;
grant execute on function public.finish_resume_operation(uuid,uuid) to service_role;

-- Defence in depth: at most one committed PDF plus one replacement per account.
-- This check is transactional, so simultaneous storage inserts cannot race it.
create function public.enforce_resume_storage_quota() returns trigger
language plpgsql security definer set search_path = '' as $$
declare owner_id uuid;
begin
  if new.bucket_id <> 'candidate-resumes' then return new; end if;
  owner_id := split_part(new.name, '/', 1)::uuid;
  if array_length(string_to_array(new.name, '/'), 1) <> 2
    or right(new.name, 4) <> '.pdf' then raise exception 'INVALID_RESUME_PATH'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('resume:' || owner_id::text, 0));
  if not exists (select 1 from public.resume_operation_limits where user_id = owner_id and leased_until > now())
    then raise exception 'RESUME_LEASE_REQUIRED'; end if;
  if (select count(*) from storage.objects where bucket_id = 'candidate-resumes' and (storage.foldername(name))[1] = owner_id::text) >= 2
    then raise exception 'RESUME_STORAGE_QUOTA'; end if;
  return new;
end;
$$;
revoke all on function public.enforce_resume_storage_quota() from public, anon, authenticated;
create trigger enforce_resume_storage_quota before insert on storage.objects
  for each row execute function public.enforce_resume_storage_quota();
commit;
