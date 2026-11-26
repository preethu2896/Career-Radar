begin;
create table public.candidate_settings (
 user_id uuid primary key references public.candidate_accounts(id) on delete cascade,
 product_updates boolean not null default false,
 updated_at timestamptz not null default now()
);
alter table public.candidate_settings enable row level security;
revoke all on public.candidate_settings from public,anon,authenticated;
grant all on public.candidate_settings to service_role;


-- Retain only an opaque identity marker so a deleted account's old tokens cannot recreate private records.
create table public.candidate_deleted_identities(issuer text not null,subject text not null,requested_at timestamptz not null default now(),primary key(issuer,subject));
alter table public.candidate_deleted_identities enable row level security;
revoke all on public.candidate_deleted_identities from public,anon,authenticated;
grant all on public.candidate_deleted_identities to service_role;
create or replace function public.ensure_clerk_candidate(p_issuer text,p_subject text,p_first_name text default '',p_last_name text default '') returns uuid language plpgsql security definer set search_path='' as $$
declare candidate uuid;
begin
 if not exists(select 1 from public.candidate_identity_providers where issuer=p_issuer and kind='clerk') or p_subject is null or length(p_subject) not between 1 and 200 then raise exception 'INVALID_IDENTITY';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('candidate:'||p_issuer||':'||p_subject,0));
 if exists(select 1 from public.candidate_deleted_identities where issuer=p_issuer and subject=p_subject) then raise exception 'ACCOUNT_DELETING';end if;
 select account_id into candidate from public.candidate_identity_links where issuer=p_issuer and subject=p_subject;
 if candidate is null then
   insert into public.candidate_accounts default values returning id into candidate;
   insert into public.candidate_identity_links(issuer,subject,account_id)values(p_issuer,p_subject,candidate);
 end if;
 insert into public.profiles(id,first_name,last_name)values(candidate,left(coalesce(p_first_name,''),100),left(coalesce(p_last_name,''),100))on conflict(id)do nothing;
 return candidate;
end $$;

commit;
