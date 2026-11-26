begin;
create table public.candidate_accounts(id uuid primary key default gen_random_uuid(),created_at timestamptz not null default now());
insert into public.candidate_accounts(id) select id from auth.users on conflict do nothing;
alter table public.candidate_accounts enable row level security;
revoke all on public.candidate_accounts from public,anon,authenticated;
grant all on public.candidate_accounts to service_role;
create table public.candidate_identity_providers(issuer text primary key,kind text not null check(kind in ('clerk','supabase')));
alter table public.candidate_identity_providers enable row level security;
revoke all on public.candidate_identity_providers from public,anon,authenticated;
grant all on public.candidate_identity_providers to service_role;
create table public.candidate_identity_links(issuer text not null references public.candidate_identity_providers(issuer),subject text not null,account_id uuid not null references public.candidate_accounts(id) on delete cascade,primary key(issuer,subject),unique(issuer,account_id));
alter table public.candidate_identity_links enable row level security;
revoke all on public.candidate_identity_links from public,anon,authenticated;
grant all on public.candidate_identity_links to service_role;

-- The gateway verifies the token. Ownership comes only from the private mapping,
-- never a browser-supplied UUID, email or user-editable metadata claim.
create function public.current_candidate_id() returns uuid language plpgsql stable security definer set search_path='' as $$
declare claims jsonb:=auth.jwt(); provider text; result uuid;
begin
 select kind into provider from public.candidate_identity_providers where issuer=claims->>'iss';
 if provider='clerk' then
   select account_id into result from public.candidate_identity_links where issuer=claims->>'iss' and subject=claims->>'sub';
   return result;
 elsif provider='supabase' and claims->>'sub' ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
   return (claims->>'sub')::uuid;
 end if;
 return null;
end $$;
revoke all on function public.current_candidate_id() from public;
grant execute on function public.current_candidate_id() to anon,authenticated,service_role;

create function public.ensure_clerk_candidate(p_issuer text,p_subject text,p_first_name text default '',p_last_name text default '') returns uuid language plpgsql security definer set search_path='' as $$
declare candidate uuid;
begin
 if not exists(select 1 from public.candidate_identity_providers where issuer=p_issuer and kind='clerk') or p_subject is null or length(p_subject) not between 1 and 200 then raise exception 'INVALID_IDENTITY';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('candidate:'||p_issuer||':'||p_subject,0));
 select account_id into candidate from public.candidate_identity_links where issuer=p_issuer and subject=p_subject;
 if candidate is null then
   insert into public.candidate_accounts default values returning id into candidate;
   insert into public.candidate_identity_links(issuer,subject,account_id)values(p_issuer,p_subject,candidate);
 end if;
 insert into public.profiles(id,first_name,last_name)values(candidate,left(coalesce(p_first_name,''),100),left(coalesce(p_last_name,''),100))on conflict(id)do nothing;
 return candidate;
end $$;
revoke all on function public.ensure_clerk_candidate(text,text,text,text) from public,anon,authenticated;
grant execute on function public.ensure_clerk_candidate(text,text,text,text) to service_role;

-- Move foreign keys, not user data or PDF objects.
-- Explicit tables keep this migration's scope reviewable.
alter table public.profiles drop constraint profiles_id_fkey, add constraint profiles_id_fkey foreign key(id)references public.candidate_accounts(id)on delete cascade;
alter table public.candidate_resumes drop constraint candidate_resumes_user_id_fkey, add constraint candidate_resumes_user_id_fkey foreign key(user_id)references public.candidate_accounts(id)on delete cascade;
alter table public.resume_operation_limits drop constraint resume_operation_limits_user_id_fkey, add constraint resume_operation_limits_user_id_fkey foreign key(user_id)references public.candidate_accounts(id)on delete cascade;
alter table public.candidate_applications drop constraint candidate_applications_user_id_fkey, add constraint candidate_applications_user_id_fkey foreign key(user_id)references public.candidate_accounts(id)on delete cascade;

-- Replace ownership helpers without changing policy roles or permissiveness.
do $$ declare item record; clause text; using_expr text; check_expr text;begin
 for item in select p.*,n.nspname,t.relname from pg_policy p join pg_class t on t.oid=p.polrelid join pg_namespace n on n.oid=t.relnamespace where (n.nspname='public' and t.relname in ('profiles','candidate_resumes','candidate_applications')) or(n.nspname='storage' and t.relname='objects' and p.polname like 'resume%') loop
   using_expr:=replace(pg_get_expr(item.polqual,item.polrelid),'auth.uid()','public.current_candidate_id()');
   check_expr:=replace(pg_get_expr(item.polwithcheck,item.polrelid),'auth.uid()','public.current_candidate_id()');
   clause:=format('alter policy %I on %I.%I',item.polname,item.nspname,item.relname);
   if using_expr is not null then clause:=clause||' using ('||using_expr||')';end if;
   if check_expr is not null then clause:=clause||' with check ('||check_expr||')';end if;
   execute clause;
 end loop;
end $$;

-- Retain a functioning legacy path for rollback and existing sessions.
create function public.sync_legacy_candidate_account()returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='INSERT' then insert into public.candidate_accounts(id)values(new.id)on conflict do nothing;return new;
 else
  if not exists(select 1 from public.candidate_identity_links where account_id=old.id)then delete from public.candidate_accounts where id=old.id;end if;
  return old;
 end if;
end $$;
revoke all on function public.sync_legacy_candidate_account() from public,anon,authenticated;
create trigger sync_legacy_candidate_insert after insert on auth.users for each row execute function public.sync_legacy_candidate_account();
create trigger sync_legacy_candidate_delete after delete on auth.users for each row execute function public.sync_legacy_candidate_account();
commit;
