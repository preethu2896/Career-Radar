// No existing user/account/resume data is read or modified by this deployment.
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,basename,resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const project='fahvirvrmozvkanmuwnu';
const quote=s=>"'"+s.replaceAll("'","''")+"'";
const command=args=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command','& npx supabase '+args.map(quote).join(' ')],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:180000});
const dir=await mkdtemp(join(tmpdir(),'careerradar-job-sync-'));let secret='';
try{
 if(!process.argv.includes('--skip-schema'))command(['db','query','--remote='+project,'--file','supabase/migrations/202611210014_live_job_feeds.sql','--yes']);
 console.log('Live-feed schema and real company board registry deployed.');
 secret=randomBytes(32).toString('hex');
 const envPath=join(dir,'worker.env');await writeFile(envPath,'JOB_SYNC_SECRET='+secret+'\n',{mode:0o600});
 command(['secrets','set','--remote='+project,'--env-file',envPath,'--yes']);
 command(['functions','deploy','sync-job-feeds','--remote='+project,'--use-api','--yes']);
 console.log('Authenticated job-sync worker deployed.');
 const sql=`begin;
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;
do $$begin
 if exists(select 1 from vault.secrets where name='careerradar_job_sync_secret') then
 perform vault.update_secret((select id from vault.secrets where name='careerradar_job_sync_secret'),${quote(secret)});
 else perform vault.create_secret(${quote(secret)},'careerradar_job_sync_secret','Dedicated job feed worker authentication'); end if;
end $$;
create or replace function public.dispatch_job_feed_sync() returns bigint language plpgsql security definer set search_path='' as $$
declare request_id bigint; worker_secret text;
begin
 select decrypted_secret into worker_secret from vault.decrypted_secrets where name='careerradar_job_sync_secret';
 if worker_secret is null then raise exception 'JOB_SYNC_NOT_CONFIGURED'; end if;
 select net.http_post(url:='https://${project}.supabase.co/functions/v1/sync-job-feeds',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||worker_secret),body:='{}'::jsonb,timeout_milliseconds:=140000) into request_id;
 return request_id;
end $$;
revoke all on function public.dispatch_job_feed_sync() from public,anon,authenticated;
select cron.schedule('careerradar-job-feeds','17 */6 * * *','select public.dispatch_job_feed_sync();');
commit;
select public.dispatch_job_feed_sync() as initial_request_id;`;
 const file=join(dir,'schedule.sql');await writeFile(file,sql,{mode:0o600});
 command(['db','query','--remote='+project,'--file',file,'--yes']);
 console.log('Six-hour hosted schedule enabled; first real collection requested.');
}catch(e){console.error('Deployment stopped: '+String(e.stderr||e.message).replaceAll(secret||'__none__','[redacted]').slice(0,1800));process.exitCode=1;}
finally{if(resolve(dirname(dir))!==resolve(tmpdir())||!basename(dir).startsWith('careerradar-job-sync-'))throw new Error('Unsafe temporary cleanup path');await rm(dir,{recursive:true,force:true});}
