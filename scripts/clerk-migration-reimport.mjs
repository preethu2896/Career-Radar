import{createClerkClient}from'@clerk/backend';import{execFileSync}from'node:child_process';import{readFile,writeFile}from'node:fs/promises';import{join}from'node:path';
const m=JSON.parse(await readFile('.clerk/migrate/baseline.json','utf8'));const c=createClerkClient({secretKey:process.env.CLERK_SECRET_KEY});
const q=v=>"'"+v.replaceAll("'","''")+"'";
const run=command=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:120000});
const current=await c.users.getUserList({limit:100});if(current.totalCount!==0)throw new Error('Stop: destination is not empty. Resolve existing identities before another import.');
try{const raw=run(`& npx -y clerk@latest logs --type user.deleted --since 2h --json`);const r=JSON.parse(raw.slice(raw.indexOf('{')));console.log(JSON.stringify({deletionEvents:r.data?.map(event=>({type:event.type,createdAt:event.created_at,userId:event.payload?.user_id}))}));}catch{console.log('Deletion audit not available through this interface.');}
const result=run(`& npx -y clerk@latest migrate import ${q(m.exportPath)} --source supabase --app ${m.app} --instance dev --runs-dir ${q(join(m.privateFolder,'runs'))} --new-run --yes --json`);
await writeFile(join(m.privateFolder,'reimport-result.json'),result,{mode:0o600});const r=JSON.parse(result.slice(result.indexOf('{')));console.log(JSON.stringify({freshRun:r.run?.id,counts:r.run?.counts}));
const mappings=[];
for(const accountId of m.accountIds){const found=await c.users.getUserList({externalId:[accountId]});if(found.data.length!==1)throw new Error('Fresh import is not visible through the application API; stop before changing identity links.');const user=await c.users.getUser(found.data[0].id);if(user.externalId!==accountId||!user.passwordEnabled)throw new Error('Identity/password preservation failed');mappings.push({accountId,subject:user.id});}
m.mappings=mappings;await writeFile('.clerk/migrate/baseline.json',JSON.stringify(m,null,2));
const sql=mappings.map(link=>`insert into public.candidate_identity_links(issuer,subject,account_id)values(${q(m.issuer)},${q(link.subject)},${q(link.accountId)})on conflict(issuer,account_id)do update set subject=excluded.subject;`).join('\n');
const path=join(m.privateFolder,'repair-links.sql');await writeFile(path,'begin;\n'+sql+'\ncommit;');run(`& npx supabase db query --remote=${m.project} --file ${q(path)} --yes`);
console.log(JSON.stringify({applicationVerifiedAccounts:mappings.length,ownerIdsPreserved:true}));
