begin;
create or replace function public.dispatch_catalogue_sync() returns bigint
language plpgsql security definer set search_path='' as $$
declare request_id bigint; worker_secret text;
begin
 select decrypted_secret into worker_secret from vault.decrypted_secrets where name='careerradar_job_sync_secret';
 if worker_secret is null then raise exception 'JOB_SYNC_NOT_CONFIGURED'; end if;
 select net.http_post(url:='https://fahvirvrmozvkanmuwnu.supabase.co/functions/v1/sync-catalogue',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||worker_secret),body:='{}'::jsonb,timeout_milliseconds:=140000) into request_id;
 return request_id;
end $$;
revoke all on function public.dispatch_catalogue_sync() from public,anon,authenticated;
do $$begin
 if not exists(select 1 from cron.job where jobname='careerradar-public-catalogue') then
 perform cron.alter_job(cron.schedule('careerradar-public-catalogue','* * * * *','select public.dispatch_catalogue_sync();'),active:=false);
 end if;
end $$;

commit;
