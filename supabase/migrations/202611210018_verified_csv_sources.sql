begin;
alter table public.job_feed_boards drop constraint job_feed_boards_provider_check;
alter table public.job_feed_boards add constraint job_feed_boards_provider_check check(provider in('GREENHOUSE','LEVER','ASHBY','WORKABLE','RECRUITEE','SCHEMA'));
alter table public.job_feed_boards add column source_urls jsonb not null default '[]'::jsonb check(jsonb_typeof(source_urls)='array' and jsonb_array_length(source_urls)<=50);
alter table public.job_feed_boards drop constraint job_feed_boards_sync_batch_check;
alter table public.job_feed_boards add constraint job_feed_boards_sync_batch_check check(sync_batch between 0 and 31);
-- Administrator-only dispatch, same dedicated Vault secret and bounded worker.
create or replace function public.dispatch_job_feed_batch(p_batch integer) returns bigint
language plpgsql security definer set search_path='' as $$
declare request_id bigint; worker_secret text;
begin
 if p_batch is null or p_batch<0 or p_batch>31 then raise exception 'INVALID_FEED_BATCH'; end if;
 select decrypted_secret into worker_secret from vault.decrypted_secrets where name='careerradar_job_sync_secret';
 if worker_secret is null then raise exception 'JOB_SYNC_NOT_CONFIGURED'; end if;
 select net.http_post(url:='https://fahvirvrmozvkanmuwnu.supabase.co/functions/v1/sync-job-feeds?batch='||p_batch,
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||worker_secret),body:='{}'::jsonb,timeout_milliseconds:=140000) into request_id;
 return request_id;
end $$;
revoke all on function public.dispatch_job_feed_batch(integer) from public,anon,authenticated;
commit;
