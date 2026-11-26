begin;
create table if not exists public.candidate_link_access (
 user_id uuid primary key references public.candidate_accounts(id) on delete cascade,
 paid_until timestamptz
);
create table if not exists public.candidate_apply_unlocks (
 user_id uuid not null references public.candidate_accounts(id) on delete cascade,
 job_id text not null check(length(job_id) between 1 and 160),
 unlocked_at timestamptz not null default now(),
 primary key(user_id,job_id)
);
alter table public.candidate_link_access enable row level security;
alter table public.candidate_apply_unlocks enable row level security;
revoke all on public.candidate_link_access,public.candidate_apply_unlocks from public,anon,authenticated;
grant all on public.candidate_link_access,public.candidate_apply_unlocks to service_role;
create or replace function public.check_candidate_link_access(p_user_id uuid,p_job_id text default null,p_consume boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare paid boolean; used integer; unlocked boolean;
begin
 if p_job_id is not null and (length(p_job_id)<1 or length(p_job_id)>160) then raise exception 'Invalid job';end if;
 insert into public.candidate_link_access(user_id) values(p_user_id) on conflict do nothing;
 select coalesce(paid_until>now(),false) into paid from public.candidate_link_access where user_id=p_user_id for update;
 select count(*) into used from public.candidate_apply_unlocks where user_id=p_user_id;
 select exists(select 1 from public.candidate_apply_unlocks where user_id=p_user_id and job_id=p_job_id) into unlocked;
 if p_consume and p_job_id is not null and not paid and not unlocked and used<3 then
  insert into public.candidate_apply_unlocks(user_id,job_id) values(p_user_id,p_job_id);
  used:=used+1;unlocked:=true;
 end if;
 return jsonb_build_object('paid',paid,'remaining',greatest(0,3-used),'unlocked',paid or unlocked);
end $$;
revoke all on function public.check_candidate_link_access(uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.check_candidate_link_access(uuid,text,boolean) to service_role;
-- Legacy raw endpoints must not bypass the protected catalogue API.
revoke select on public.career_opportunities from anon,authenticated;
commit;
