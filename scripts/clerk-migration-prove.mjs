import{createClerkClient}from'@clerk/backend';import{createClient}from'@supabase/supabase-js';import{readFile,writeFile}from'node:fs/promises';import{createHash}from'node:crypto';
const m=JSON.parse(await readFile('.clerk/migrate/baseline.json','utf8'));
const clerk=createClerkClient({secretKey:process.env.CLERK_SECRET_KEY,publishableKey:process.env.VITE_CLERK_PUBLISHABLE_KEY});
const results=[];const sessions=[];
try{
 for(const link of m.mappings){
  const user=await clerk.users.getUser(link.subject);
  if(user.externalId!==link.accountId||!user.passwordEnabled)throw new Error('Imported identity or password support was not preserved');
  const session=await clerk.sessions.createSession({userId:link.subject});sessions.push(session.id);
  const token=(await clerk.sessions.getToken(session.id)).jwt;
  const client=createClient(process.env.VITE_SUPABASE_URL,process.env.VITE_SUPABASE_ANON_KEY,{accessToken:async()=>token});
  const own=await client.from('candidate_resumes').select('*');if(own.error)throw new Error('Native provider data access failed: '+own.error.message);
  if(own.data.some(row=>row.user_id!==link.accountId))throw new Error('Cross-user metadata exposed');
  const identity=await client.functions.invoke('candidate-identity',{method:'POST'});if(identity.error||identity.data.user_id!==link.accountId)throw new Error('Backend identity did not preserve the UUID');
  const other=m.mappings.find(value=>value.accountId!==link.accountId);
  const forbidden=await client.from('candidate_resumes').select('*').eq('user_id',other.accountId);if(forbidden.error||forbidden.data.length)throw new Error('Another account metadata access was not denied');
  for(const record of own.data){const download=await client.storage.from('candidate-resumes').download(record.storage_path);if(download.error)throw new Error('Existing private resume download failed');const bytes=Buffer.from(await download.data.arrayBuffer());if(!bytes.subarray(0,5).equals(Buffer.from('%PDF-')))throw new Error('Stored resume is not a PDF');results.push({ownerId:link.accountId,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}
 }
 await writeFile('.clerk/migrate/preservation-proof.json',JSON.stringify({passed:true,accounts:m.mappings.length,resumes:results},null,2));
 console.log(JSON.stringify({passed:true,migratedAccounts:m.mappings.length,existingResumesDownloaded:results.length,ownership:'isolated',passwordHashes:'supported by imported accounts'}));
}catch(error){console.error(error.message);process.exitCode=1;}finally{for(const id of sessions)await clerk.sessions.revokeSession(id).catch(()=>{});}
