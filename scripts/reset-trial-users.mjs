import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createClerkClient} from '@clerk/backend';
import {createClient} from '@supabase/supabase-js';
const project='fahvirvrmozvkanmuwnu';
assert.equal(new URL(process.env.VITE_SUPABASE_URL).hostname,project+'.supabase.co');
const issuer=Buffer.from(process.env.VITE_CLERK_PUBLISHABLE_KEY.split('_').slice(2).join('_'),'base64').toString().replace(/\$$/,'');
assert.equal(issuer,'choice-dove-8270.clerk.accounts.dev');
const clerk=createClerkClient({secretKey:process.env.CLERK_SECRET_KEY});
const folder='qa-artifacts/trial-user-reset-20261124';await mkdir(folder,{recursive:true});
function cli(command){try{return execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:120000});}catch{throw new Error('Supabase CLI operation failed. Sensitive output withheld; no further steps executed.');}}
function json(text){return JSON.parse(text.slice(text.indexOf('{')>=0&&text.indexOf('{')<text.indexOf('[')?text.indexOf('{'):text.indexOf('[')>=0?text.indexOf('['):text.indexOf('{')));}
async function sql(query,write=false){const path=folder+'/query.sql';await writeFile(path,query);const raw=cli(`npx supabase db query --remote=${project} ${write?'--yes':'--read-only'} --file '${path}'`);return JSON.parse(raw.slice(raw.indexOf('{'))).rows;}
async function users(){const all=[];for(let offset=0;;offset+=100){const r=await clerk.users.getUserList({limit:100,offset});all.push(...r.data.map(u=>u.id));if(r.data.length<100)break;}return all;}
const query=`select jsonb_build_object('accounts',(select coalesce(jsonb_agg(id),'[]')from public.candidate_accounts),'authUsers',(select coalesce(jsonb_agg(id),'[]')from auth.users),'storage',(select coalesce(jsonb_agg(jsonb_build_object('name',name,'id',id)),'[]')from storage.objects where bucket_id='candidate-resumes'),'profiles',(select count(*)from public.profiles),'resumes',(select count(*)from public.candidate_resumes),'applications',(select count(*)from public.candidate_applications),'saves',(select count(*)from public.candidate_saved_companies),'links',(select count(*)from public.candidate_identity_links),'limits',(select count(*)from public.resume_operation_limits),'jobs',(select count(*)from public.career_opportunities),'companies',null)as payload;`;
function count(p,c){return {clerkUsers:c.length,supabaseAuthUsers:p.authUsers.length,candidateAccounts:p.accounts.length,profiles:p.profiles,resumeRecords:p.resumes,resumeFiles:p.storage.length,savedApplications:p.applications,savedCompanies:p.saves,identityLinks:p.links,jobs:p.jobs,companies:p.companies};}
async function admin(){
 const raw=cli(`npx supabase projects api-keys --remote=${project} --reveal --output json`);
 const start=raw.search(/[\[{]/);const data=JSON.parse(raw.slice(start));const objects=[];
 function walk(o){if(!o||typeof o!=='object')return;if(!Array.isArray(o))objects.push(o);for(const v of Object.values(o))if(v&&typeof v==='object')walk(v);}walk(data);
 const candidates=objects.flatMap(o=>Object.entries(o).filter(([k,v])=>typeof v==='string'&&['api_key','key','secret','value'].includes(k)).map(([k,v])=>({o,v})));
 const found=candidates.find(({v})=>{try{return JSON.parse(Buffer.from(v.split('.')[1],'base64url').toString()).role==='service_role';}catch{return false;}})??candidates.find(({v})=>v.startsWith('sb_secret_'));
 assert.ok(found,'No administrative Supabase key returned. No deletions performed.');return createClient(process.env.VITE_SUPABASE_URL,found.v,{auth:{persistSession:false,autoRefreshToken:false}});
}
const companyFileHash=createHash('sha256').update(await readFile('public/data/discovery-companies.json')).digest('hex');
const action=process.argv[2]??'inventory';
if(action==='inventory'){
 const payload=(await sql(query))[0].payload;const clerkUsers=await users();await admin();
 await writeFile(folder+'/manifest.json',JSON.stringify({project,issuer,createdAt:new Date().toISOString(),companyFileHash,clerkUsers,payload},null,2));
 console.log(JSON.stringify({inventory:count(payload,clerkUsers),adminAccessVerified:true}));
}else if(action==='delete'){
 const manifest=JSON.parse(await readFile(folder+'/manifest.json','utf8'));assert.equal(manifest.project,project);assert.equal(manifest.issuer,issuer);
 const current=(await sql(query))[0].payload;assert.deepEqual(current.accounts.slice().sort(),manifest.payload.accounts.slice().sort());assert.deepEqual((await users()).sort(),manifest.clerkUsers.slice().sort());assert.deepEqual(current.authUsers.slice().sort(),manifest.payload.authUsers.slice().sort());assert.deepEqual(current.storage.map(o=>o.name).sort(),manifest.payload.storage.map(o=>o.name).sort());
 const client=await admin();
 for(const id of manifest.clerkUsers){await clerk.users.deleteUser(id);}console.log('Removed Clerk trial accounts and revoked their sessions.');
 const names=manifest.payload.storage.map(o=>o.name);for(let i=0;i<names.length;i+=100){const r=await client.storage.from('candidate-resumes').remove(names.slice(i,i+100));if(r.error)throw new Error('Resume Storage deletion failed; remaining cleanup must be resumed.');}console.log('Removed trial resume files through the Storage API.');
 for(const id of manifest.payload.authUsers){const r=await client.auth.admin.deleteUser(id);if(r.error)throw new Error('Supabase Auth deletion failed.');}
 const ids=manifest.payload.accounts;ids.forEach(id=>assert.match(id,/^[0-9a-f-]{36}$/i));if(ids.length)await sql(`begin;delete from public.candidate_accounts where id in (${ids.map(id=>"'"+id+"'").join(',')});commit;`,true);
 const final=(await sql(query))[0].payload;const clerkLeft=await users();
 assert.equal(clerkLeft.length,0);for(const key of ['accounts','authUsers','storage'])assert.equal(final[key].length,0);for(const key of ['profiles','resumes','applications','saves','links','limits'])assert.equal(final[key],0);
 assert.equal(companyFileHash,manifest.companyFileHash);assert.equal(final.jobs,manifest.payload.jobs);
 const report={complete:true,localCompanyDirectoryUnchanged:true,removed:count(manifest.payload,manifest.clerkUsers),remaining:count(final,clerkLeft),checkedAt:new Date().toISOString()};await writeFile(folder+'/result.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}else throw new Error('Unknown action');
