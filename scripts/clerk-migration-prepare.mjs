import { execFileSync } from 'node:child_process';
import { mkdir,writeFile,readFile,copyFile } from 'node:fs/promises';
import { join,resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
const project='fahvirvrmozvkanmuwnu';
const app='app_3MN4yZno4sVNyict29RaVzQc4N4';
const folder=join(tmpdir(),'careerradar-clerk-'+randomUUID());
await mkdir(folder,{recursive:true});
await mkdir('.clerk/migrate',{recursive:true});
await mkdir('.clerk/rollback',{recursive:true});
const files=['src/services/auth.ts','src/ui/AuthFlows.tsx','src/main.tsx','src/services/resumeStorage.ts','src/services/candidateWorkspace.ts','securityHeaders.ts','supabase/config.toml'];
for(let index=0;index<files.length;index++)await copyFile(files[index],`.clerk/rollback/${index}-${files[index].replaceAll('/','_')}`);
const sql=`select jsonb_build_object(
 'users',(select jsonb_agg(jsonb_build_object('id',u.id,'email',u.email,'encrypted_password',u.encrypted_password,'email_confirmed_at',u.email_confirmed_at,'phone',u.phone,'phone_confirmed_at',u.phone_confirmed_at,'first_name',coalesce(nullif(p.first_name,''),u.raw_user_meta_data->>'first_name',''),'last_name',coalesce(nullif(p.last_name,''),u.raw_user_meta_data->>'last_name',''),'raw_user_meta_data',u.raw_user_meta_data,'raw_app_meta_data',u.raw_app_meta_data,'created_at',u.created_at,'banned_until',u.banned_until,'is_anonymous',u.is_anonymous) order by u.id) from auth.users u left join public.profiles p on p.id=u.id where u.deleted_at is null),
 'baseline',jsonb_build_object(
 'profiles',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'digest',md5(row_to_json(p)::text)) order by p.id),'[]'::jsonb) from public.profiles p),
 'resumes',(select coalesce(jsonb_agg(jsonb_build_object('id',r.user_id,'digest',md5(row_to_json(r)::text)) order by r.user_id),'[]'::jsonb) from public.candidate_resumes r),
 'objects',(select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'digest',md5(row_to_json(o)::text)) order by o.id),'[]'::jsonb) from storage.objects o where o.bucket_id='candidate-resumes'),
 'applications',(select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'digest',md5(row_to_json(a)::text)) order by a.id),'[]'::jsonb) from public.candidate_applications a)
 )) as payload;`;
const sqlPath=join(folder,'export.sql');await writeFile(sqlPath,sql,{mode:0o600});
const quote=value=>"'"+value.replaceAll("'","''")+"'";
function run(command){return execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:120000});}
const output=run(`& npx supabase db query --remote=${project} --read-only --file ${quote(sqlPath)}`);
const payload=JSON.parse(output.slice(output.indexOf('{'))).rows[0].payload;
if(!Array.isArray(payload.users)||payload.users.length!==2)throw new Error('Account count changed; stop before importing.');
const exportPath=join(folder,'users.json');await writeFile(exportPath,JSON.stringify(payload.users),{mode:0o600});
const manifest={project,app,privateFolder:folder,exportPath,accountIds:payload.users.map(user=>user.id),baseline:payload.baseline};
await writeFile('.clerk/migrate/baseline.json',JSON.stringify(manifest,null,2),{mode:0o600});
let dryRun;
try{dryRun=run(`& npx -y clerk@latest migrate import ${quote(exportPath)} --source supabase --app ${app} --instance dev --runs-dir ${quote(join(folder,'runs'))} --dry-run --json`);}
catch(error){await writeFile(join(folder,'dry-run-private-error.txt'),String(error.stdout??''),{mode:0o600});throw new Error('Migration validation failed; private diagnostics were retained without printing account data.');}
await writeFile(join(folder,'dry-run.json'),dryRun,{mode:0o600});
textSummary();
function textSummary(){console.log(JSON.stringify({phase:'validated',accounts:payload.users.length,profiles:payload.baseline.profiles.length,resumes:payload.baseline.resumes.length,objects:payload.baseline.objects.length,exportLocation:'private Windows temporary folder',migrationState:'.clerk/migrate/baseline.json'}));}
