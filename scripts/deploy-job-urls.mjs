import {execFileSync} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
const q=s=>"'"+s.replaceAll("'","''")+"'";
const cli=args=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command','& npx supabase '+args.map(q).join(' ')],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:180000});
const query=sql=>{const output=cli(['db','query','--remote=fahvirvrmozvkanmuwnu','--read-only',sql]);return JSON.parse(output.slice(output.indexOf('{'))).rows;};
const fingerprint=()=>query("select count(*) as count,md5(string_agg(concat_ws('|',id,company_name,title,source_url,first_seen_at,published_at),'' order by id)) as fingerprint from career_opportunities")[0];
try{
 const before=fingerprint();cli(['db','query','--remote=fahvirvrmozvkanmuwnu','--file','supabase/migrations/202611210017_readable_job_urls.sql','--yes']);
 const after=fingerprint();if(before.count!==after.count||before.fingerprint!==after.fingerprint)throw new Error('Original job data fingerprint changed; inspect before continuing');
 const samples=query("select '/jobs/'||company_slug||'/'||role_slug as path from career_opportunities where publication_state='PUBLISHED' order by company_name,title limit 3");
 await writeFile('qa-artifacts/readable-job-url-deployment.json',JSON.stringify({passed:true,deployedAt:new Date().toISOString(),before,after,samples},null,2));console.log('Deployed stable company/role URLs. Existing job IDs, titles, source links and dates preserved. '+JSON.stringify(samples));
}catch(e){console.error(String(e.stderr||e.message).slice(0,1800));process.exitCode=1;}
