-- Supabase storage.objects has an owner_id column. Avoid PL/pgSQL variable
-- names that collide with real Storage columns. Preserve all quota/access rules.
begin;
create or replace function public.enforce_resume_storage_quota() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_resume_user_id uuid;
begin
  if new.bucket_id <> 'candidate-resumes' then return new; end if;
  v_resume_user_id := split_part(new.name, '/', 1)::uuid;
  if array_length(string_to_array(new.name, '/'), 1) <> 2
    or right(new.name, 4) <> '.pdf' then raise exception 'INVALID_RESUME_PATH'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('resume:' || v_resume_user_id::text, 0));
  if not exists (
    select 1 from public.resume_operation_limits as operation
    where operation.user_id = v_resume_user_id and operation.leased_until > now()
  ) then raise exception 'RESUME_LEASE_REQUIRED'; end if;
  if (
    select count(*) from storage.objects as stored_object
    where stored_object.bucket_id = 'candidate-resumes'
      and (storage.foldername(stored_object.name))[1] = v_resume_user_id::text
  ) >= 2 then raise exception 'RESUME_STORAGE_QUOTA'; end if;
  return new;
end;
$$;
revoke all on function public.enforce_resume_storage_quota() from public, anon, authenticated;
commit;
