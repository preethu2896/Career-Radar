begin;
alter table public.job_feed_boards add column sync_batch smallint not null default 0 check(sync_batch between 0 and 7);
create index job_feed_board_batch_idx on public.job_feed_boards(sync_batch) where enabled;
alter table public.career_opportunities add column employment_type text check(length(employment_type)<=100);

-- Bounded batches keep every source within hosted worker limits. The existing
-- global lease still prevents overlapping snapshots from separate invocations.
create function public.dispatch_job_feed_batch(p_batch integer) returns bigint
language plpgsql security definer set search_path='' as $$
declare request_id bigint; worker_secret text;
begin
 if p_batch is null or p_batch<0 or p_batch>7 then raise exception 'INVALID_FEED_BATCH'; end if;
 select decrypted_secret into worker_secret from vault.decrypted_secrets where name='careerradar_job_sync_secret';
 if worker_secret is null then raise exception 'JOB_SYNC_NOT_CONFIGURED'; end if;
 select net.http_post(
  url:='https://fahvirvrmozvkanmuwnu.supabase.co/functions/v1/sync-job-feeds?batch='||p_batch,
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||worker_secret),
  body:='{}'::jsonb,timeout_milliseconds:=140000
 ) into request_id;
 return request_id;
end $$;
revoke all on function public.dispatch_job_feed_batch(integer) from public,anon,authenticated;

-- Backwards-compatible manual/cron dispatcher for the original eight boards.
create or replace function public.dispatch_job_feed_sync() returns bigint
language sql security definer set search_path='' as $$select public.dispatch_job_feed_batch(0);$$;
revoke all on function public.dispatch_job_feed_sync() from public,anon,authenticated;
-- Source descriptions may be empty. Retain the real source URL; never invent text.
create or replace function public.apply_job_feed_snapshot(p_run_id uuid,p_board_id uuid,p_jobs jsonb) returns jsonb
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
    or jsonb_typeof(item->'skills')<>'array'
    or (item->>'published_at')::timestamptz>now()+interval '5 minutes'
    then raise exception 'INVALID_JOB'; end if;
  insert into public.career_opportunities as existing(
   company_name,title,location,work_mode,experience_requirement,description,skills,employment_type,
   source_url,application_url,source_kind,status,publication_state,published_at,last_checked_at,
   feed_board_id,source_job_id,last_seen_run_id,missing_checks
  ) values (
   board.company_name,item->>'title',item->>'location',item->>'work_mode',item->>'experience_requirement',item->>'description',item->'skills',item->>'employment_type',
   item->>'source_url',item->>'application_url','OFFICIAL','OPEN','PUBLISHED',(item->>'published_at')::timestamptz,now(),
   p_board_id,item->>'source_job_id',p_run_id,0
  ) on conflict(feed_board_id,source_job_id) do update set
   company_name=excluded.company_name,title=excluded.title,location=excluded.location,work_mode=excluded.work_mode,
   experience_requirement=excluded.experience_requirement,description=excluded.description,skills=excluded.skills,employment_type=excluded.employment_type,
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


commit;
