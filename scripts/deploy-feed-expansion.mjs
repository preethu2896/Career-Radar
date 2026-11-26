import {execFileSync} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
const project='fahvirvrmozvkanmuwnu';const q=s=>"'"+s.replaceAll("'","''")+"'";
const cli=args=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command','& npx supabase '+args.map(q).join(' ')],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:180000});
const query=(sql,readOnly=true)=>{const output=cli(['db','query','--remote='+project,...(readOnly?['--read-only']:['--yes']),sql]);return JSON.parse(output.slice(output.indexOf('{'))).rows;};
const fingerprint=()=>query("select count(*) as count,md5(string_agg(o.id::text||o.first_seen_at::text||coalesce(o.published_at::text,''),'' order by o.id)) as fingerprint from public.career_opportunities o join public.job_feed_boards b on b.id=o.feed_board_id where b.sync_batch=0")[0];
try{
 if(!process.argv.includes('--refresh-only')){
  cli(['db','query','--remote='+project,'--file','supabase/migrations/202611210015_job_feed_batches.sql','--yes']);console.log('Batch schema and secure dispatchers deployed.');
  cli(['functions','deploy','sync-job-feeds','--remote='+project,'--use-api','--yes']);console.log('Bounded batch worker deployed.');
  cli(['db','query','--remote='+project,'--file','supabase/migrations/202611210016_more_india_job_sources.sql','--yes']);console.log('33 verified employers and staggered six-hour schedules enabled.');
 }
 const before=fingerprint();const batches=query('select distinct sync_batch from public.job_feed_boards where enabled order by sync_batch');const runs=[];
 for(const {sync_batch:batch}of batches){
  const request=query('select public.dispatch_job_feed_batch('+Number(batch)+') as id',false)[0].id;
  const deadline=Date.now()+175000;let done=false;
  while(Date.now()<deadline){
   const response=query('select status_code,content,timed_out,error_msg from net._http_response where id='+Number(request))[0];
   if(response){if(response.status_code!==200)throw new Error('Batch '+batch+' HTTP '+response.status_code+': '+String(response.content||response.error_msg).slice(0,500));const result=JSON.parse(response.content);runs.push(result);console.log(JSON.stringify({batch,state:result.state,sources:result.sources,published:result.published,failures:result.failures}));if(result.state!=='SUCCEEDED')throw new Error('Batch '+batch+' needs review: '+JSON.stringify(result.outcomes));done=true;break;}
   await new Promise(resolve=>setTimeout(resolve,1500));
  }
  if(!done)throw new Error('Batch '+batch+' response timed out; check hosted run before retrying');
 }
 const after=fingerprint();const summary=query(`select jsonb_build_object('companies',(select count(*) from job_feed_boards where enabled),'jobs',(select count(*) from career_opportunities where publication_state='PUBLISHED' and status='OPEN'),'internships',(select count(*) from career_opportunities where publication_state='PUBLISHED' and status='OPEN' and (title ~* '\\mintern(ship)?\\M' or employment_type ~* '\\mintern(ship)?\\M')),'sources',(select jsonb_agg(s) from (select provider,count(*) from job_feed_boards where enabled group by provider) s),'schedules',(select jsonb_agg(j) from (select jobname,schedule,active from cron.job where jobname like 'careerradar-job-feeds%' order by jobname) j)) as summary`)[0].summary;
 const report={deployedAt:new Date().toISOString(),originalJobIdentityDatesPreserved:before.count===after.count&&before.fingerprint===after.fingerprint,before,after,summary,runs};await writeFile('qa-artifacts/feed-expansion-deployment.json',JSON.stringify(report,null,2));console.log('VERIFIED '+JSON.stringify({originalJobsPreserved:report.originalJobIdentityDatesPreserved,...summary}));
}catch(e){console.error('Expansion stopped: '+String(e.stderr||e.message).slice(0,2000));process.exitCode=1;}
