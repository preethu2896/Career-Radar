import assert from 'node:assert/strict';
import { readFile,writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createClerkClient } from '@clerk/backend';
import { createClient } from '@supabase/supabase-js';
const baseline=JSON.parse(await readFile('.clerk/migrate/baseline.json','utf8'));
const failedRun='a63dc052-dc55-4ea5-9357-dba969beebde';
// This UUID came from that failed test's guarded cleanup SQL, not a user account.
const candidates=new Set(['226632ae-6f6b-498d-bf5c-d2d31dce039a']);
const clerk=createClerkClient({secretKey:process.env.CLERK_SECRET_KEY});
const users=(await clerk.users.getUserList({limit:100})).data.filter(user=>user.privateMetadata.qa_run===failedRun);
for(const user of users){
 assert.ok(!baseline.mappings.some(link=>link.subject===user.id));
 assert.ok(user.emailAddresses.some(email=>email.emailAddress.startsWith('qa-discovery-'+failedRun)&&email.emailAddress.endsWith('+clerk_test@example.com')));
 const session=await clerk.sessions.createSession({userId:user.id});
 try{const client=createClient(process.env.VITE_SUPABASE_URL,process.env.VITE_SUPABASE_ANON_KEY,{accessToken:async()=>(await clerk.sessions.getToken(session.id)).jwt});const result=await client.functions.invoke('candidate-identity',{method:'POST'});if(result.error)throw new Error('QA identity lookup failed');candidates.add(result.data.user_id);}finally{await clerk.sessions.revokeSession(session.id).catch(()=>{});}
 await clerk.users.deleteUser(user.id);
}
for(const id of candidates){assert.match(id,/^[0-9a-f-]{36}$/);assert.ok(!baseline.accountIds.includes(id));}
const sql=`delete from public.candidate_accounts where id in (${[...candidates].map(id=>"'"+id+"'").join(',')}) and id not in (${baseline.accountIds.map(id=>"'"+id+"'").join(',')});`;
await writeFile('qa-artifacts/board-recovery-cleanup.sql',sql);
execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',`npx supabase db query --remote=${baseline.project} --file qa-artifacts/board-recovery-cleanup.sql --yes`],{stdio:['ignore','pipe','pipe'],timeout:60000});
console.log(JSON.stringify({cleanupComplete:true,disposableClerkUsers:users.length,disposableCandidateIds:candidates.size}));
