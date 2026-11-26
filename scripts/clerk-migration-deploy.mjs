import{readFile,writeFile}from'node:fs/promises';import{join}from'node:path';import{execFileSync}from'node:child_process';
const m=JSON.parse(await readFile('.clerk/migrate/baseline.json','utf8'));
const quote=v=>"'"+v.replaceAll("'","''")+"'";
const run=c=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',c],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:180000});
let sql=await readFile('supabase/migrations/202611200012_clerk_identity.sql','utf8');
const seeds=`insert into public.candidate_identity_providers values(${quote(m.issuer)},'clerk'),('https://${m.project}.supabase.co/auth/v1','supabase');\n`+m.mappings.map(link=>`insert into public.candidate_identity_links values(${quote(m.issuer)},${quote(link.subject)},${quote(link.accountId)});`).join('\n');
sql=sql.replace('commit;',seeds+'\ncommit;');
const sqlPath=join(m.privateFolder,'identity-deploy.sql');await writeFile(sqlPath,sql,{mode:0o600});
run(`& npx supabase db query --remote=${m.project} --file ${quote(sqlPath)} --yes`);
console.log('Identity schema deployed; original UUID ownership retained.');
run(`& npx supabase secrets set --remote=${m.project} --env-file ${quote(join(m.privateFolder,'clerk-runtime.env'))} --yes`);
console.log('Clerk issuer configured; no backend secret exposed to the frontend.');
for(const name of ['candidate-identity','manage-resume']){run(`& npx supabase functions deploy ${name} --remote=${m.project} --use-api --yes`);console.log('Deployed '+name+' with in-function token verification.');}
await writeFile('.clerk/migrate/backend-deployed.json',JSON.stringify({deployedAt:new Date().toISOString(),project:m.project,issuer:m.issuer,accounts:m.mappings.length}));
