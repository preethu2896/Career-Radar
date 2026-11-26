begin;
create table public.job_feed_boards (
 id uuid primary key default gen_random_uuid(),
 provider text not null check(provider in ('GREENHOUSE','LEVER','ASHBY')),
 board_slug text not null check(board_slug ~ '^[a-zA-Z0-9_-]{1,100}$'),
 company_name text not null check(length(company_name) between 1 and 160),
 official_careers_url text not null check(official_careers_url ~ '^https://'),
 enabled boolean not null default true,
 last_success_at timestamptz, last_attempt_at timestamptz, last_error text,
 last_job_count integer not null default 0, last_run_id uuid,
 unique(provider,board_slug)
);
create table public.job_feed_runs (
 id uuid primary key default gen_random_uuid(), started_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '4 minutes', finished_at timestamptz,
 state text not null default 'RUNNING' check(state in ('RUNNING','SUCCEEDED','PARTIAL','FAILED','ABANDONED')),
 summary jsonb not null default '{}'
);
alter table public.career_opportunities
 add column feed_board_id uuid references public.job_feed_boards(id),
 add column source_job_id text,
 add column last_seen_run_id uuid,
 add column missing_checks integer not null default 0 check(missing_checks>=0),
 add constraint opportunity_feed_identity check((feed_board_id is null) = (source_job_id is null)),
 add constraint opportunity_source_job_unique unique(feed_board_id,source_job_id);
create index opportunities_feed_board_idx on public.career_opportunities(feed_board_id);
alter table public.job_feed_boards enable row level security;
alter table public.job_feed_runs enable row level security;
revoke all on public.job_feed_boards,public.job_feed_runs from public,anon,authenticated;
grant all on public.job_feed_boards,public.job_feed_runs to service_role;

-- A run lease prevents overlapping invocations, even from different workers.
create function public.start_job_feed_run() returns uuid
language plpgsql security definer set search_path='' as $$
declare run_id uuid;
begin
 if not pg_try_advisory_xact_lock(721120261121::bigint) then return null; end if;
 if exists(select 1 from public.job_feed_runs where state='RUNNING' and expires_at>now()) then return null; end if;
 update public.job_feed_runs set state='ABANDONED',finished_at=now() where state='RUNNING' and expires_at<=now();
 insert into public.job_feed_runs default values returning id into run_id;
 -- Only collector diagnostics are retained for 30 days. Never touches candidate data.
 delete from public.job_feed_runs where started_at<now()-interval '30 days' and state<>'RUNNING';
 return run_id;
end $$;

-- One complete board snapshot is committed atomically. Failed/partial fetches never call this.
create function public.apply_job_feed_snapshot(p_run_id uuid,p_board_id uuid,p_jobs jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare board public.job_feed_boards; item jsonb; missing integer; count_jobs integer; seen_ids text[];
begin
 perform 1 from public.job_feed_runs where id=p_run_id and state='RUNNING' and expires_at>now() for update;
 if not found then raise exception 'INVALID_OR_EXPIRED_RUN'; end if;
 select * into board from public.job_feed_boards where id=p_board_id and enabled for update;
 if not found then raise exception 'BOARD_DISABLED_OR_MISSING'; end if;
 if board.last_run_id=p_run_id then raise exception 'SNAPSHOT_ALREADY_APPLIED'; end if;
 if jsonb_typeof(p_jobs)<>'array' or jsonb_array_length(p_jobs)>5000 then raise exception 'INVALID_SNAPSHOT'; end if;
 select array_agg(j->>'source_job_id'),count(*) into seen_ids,count_jobs from jsonb_array_elements(p_jobs) j;
 if (select count(distinct v) from unnest(seen_ids) v)<>count_jobs then raise exception 'DUPLICATE_SOURCE_IDS'; end if;
 for item in select * from jsonb_array_elements(p_jobs) loop
  if nullif(item->>'source_job_id','') is null or length(item->>'source_job_id')>200
    or nullif(item->>'location','') is null or length(item->>'description')>60000
    or nullif(item->>'description','') is null or jsonb_typeof(item->'skills')<>'array'
    or (item->>'published_at')::timestamptz>now()+interval '5 minutes'
    then raise exception 'INVALID_JOB'; end if;
  insert into public.career_opportunities as existing(
   company_name,title,location,work_mode,experience_requirement,description,skills,
   source_url,application_url,source_kind,status,publication_state,published_at,last_checked_at,
   feed_board_id,source_job_id,last_seen_run_id,missing_checks
  ) values (
   board.company_name,item->>'title',item->>'location',item->>'work_mode',item->>'experience_requirement',item->>'description',item->'skills',
   item->>'source_url',item->>'application_url','OFFICIAL','OPEN','PUBLISHED',(item->>'published_at')::timestamptz,now(),
   p_board_id,item->>'source_job_id',p_run_id,0
  ) on conflict(feed_board_id,source_job_id) do update set
   company_name=excluded.company_name,title=excluded.title,location=excluded.location,work_mode=excluded.work_mode,
   experience_requirement=excluded.experience_requirement,description=excluded.description,skills=excluded.skills,
   source_url=excluded.source_url,application_url=excluded.application_url,
   published_at=coalesce(existing.published_at,excluded.published_at),
   source_kind='OFFICIAL',status='OPEN',publication_state='PUBLISHED',last_checked_at=now(),last_seen_run_id=p_run_id,missing_checks=0;
 end loop;
 update public.career_opportunities set missing_checks=missing_checks+1,
  status=case when missing_checks+1>=2 then 'CLOSED' else 'UNKNOWN' end,publication_state='DRAFT'
  where feed_board_id=p_board_id and last_seen_run_id is distinct from p_run_id and status<>'CLOSED';
 get diagnostics missing = row_count;
 update public.job_feed_boards set last_success_at=now(),last_attempt_at=now(),last_error=null,last_job_count=count_jobs,last_run_id=p_run_id where id=p_board_id;
 return jsonb_build_object('published',count_jobs,'missing',missing);
end $$;

create function public.finish_job_feed_run(p_run_id uuid,p_state text,p_summary jsonb) returns void
language plpgsql security definer set search_path='' as $$
begin
 if p_state not in ('SUCCEEDED','PARTIAL','FAILED') then raise exception 'INVALID_RUN_STATE'; end if;
 update public.job_feed_runs set state=p_state,finished_at=now(),summary=p_summary where id=p_run_id and state='RUNNING';
end $$;
revoke all on function public.start_job_feed_run(),public.apply_job_feed_snapshot(uuid,uuid,jsonb),public.finish_job_feed_run(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.start_job_feed_run(),public.apply_job_feed_snapshot(uuid,uuid,jsonb),public.finish_job_feed_run(uuid,text,jsonb) to service_role;

drop policy "published opportunities readable" on public.career_opportunities;
create policy "published opportunities readable" on public.career_opportunities for select to anon,authenticated
using(publication_state='PUBLISHED' and (feed_board_id is null or (status='OPEN' and last_checked_at>now()-interval '72 hours')));

-- Existing audited company board addresses; only a current successful feed publishes vacancies.
insert into public.job_feed_boards(provider,board_slug,company_name,official_careers_url) values
 ('GREENHOUSE','endorlabs','Endor Labs','https://job-boards.greenhouse.io/endorlabs'),
 ('GREENHOUSE','hackerrank','HackerRank','https://job-boards.greenhouse.io/hackerrank'),
 ('GREENHOUSE','razorpaysoftwareprivatelimited','Razorpay','https://job-boards.greenhouse.io/razorpaysoftwareprivatelimited'),
 ('GREENHOUSE','rockstargames','Rockstar Games','https://job-boards.greenhouse.io/rockstargames'),
 ('GREENHOUSE','sigmoid','Sigmoid','https://job-boards.greenhouse.io/sigmoid'),
 ('LEVER','hevodata','Hevo Data','https://jobs.lever.co/hevodata'),
 ('LEVER','stable-money1','Stable Money','https://jobs.lever.co/stable-money1'),
 ('ASHBY','sarvam','Sarvam','https://www.sarvam.ai/careers')
on conflict(provider,board_slug) do nothing;
commit;
