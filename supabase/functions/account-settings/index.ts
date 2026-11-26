import {createRemoteJWKSet,jwtVerify} from 'npm:jose@6.2.18';
import {createClient} from 'npm:@supabase/supabase-js@2.117.3';
import {allowedOrigins} from '../_shared/allowedOrigins.ts';
import {createAccountHandler,type AccountIdentity} from '../_shared/accountHandler.ts';
const issuer=Deno.env.get('CLERK_ISSUER')??'',secret=Deno.env.get('CLERK_SECRET_KEY')??'';
const jwks=issuer?createRemoteJWKSet(new URL(issuer+'/.well-known/jwks.json')):null;
const origins=allowedOrigins(Deno.env.get('CAREERRADAR_ALLOWED_ORIGINS'),Deno.env.get('CAREERRADAR_DEPLOYMENT_ORIGINS'));
Deno.serve(async request=>{
 const signal=AbortSignal.timeout(45000);
 const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false},global:{fetch:(input,init)=>fetch(input,{...init,signal})}});
 const check=(error:unknown)=>{if(error)throw Error('Provider operation failed');};
 const clerk=async(path:string,method='GET')=>{if(!secret)throw Error('Clerk not configured');return fetch('https://api.clerk.com/v1/'+path,{method,headers:{Authorization:'Bearer '+secret},signal});};
 return createAccountHandler({
  async authorize(token){
   if(!jwks)return null;
   let payload;try{({payload}=await jwtVerify(token,jwks,{issuer,algorithms:['RS256'],requiredClaims:['exp','iat','sub','iss','sid'],clockTolerance:5}));}catch{return null;}
   if(typeof payload.sub!=='string'||typeof payload.sid!=='string'||payload.azp!==undefined&&(typeof payload.azp!=='string'||!origins.includes(payload.azp)))return null;
   const response=await clerk('sessions/'+encodeURIComponent(payload.sid));if(!response.ok)return null;
   const session=await response.json();if(session.status!=='active'||session.user_id!==payload.sub)return null;
   const ur=await clerk('users/'+encodeURIComponent(payload.sub));if(!ur.ok)return null;const u=await ur.json();
   const primary=u.email_addresses?.find((email:any)=>email.id===u.primary_email_address_id&&email.verification?.status==='verified');if(!primary)return null;
   const{data,error}=await admin.from('candidate_identity_links').select('account_id').eq('issuer',issuer).eq('subject',payload.sub).maybeSingle();check(error);
   return{id:data?.account_id??'',subject:payload.sub,email:primary.email_address,passwordEnabled:u.password_enabled===true,providers:(u.external_accounts??[]).map((a:any)=>String(a.provider))};
  },
  async read(user){
   if(!user.id)throw Error('Account mapping missing');
   const[prefs,access,unlocks]=await Promise.all([admin.from('candidate_settings').select('product_updates').eq('user_id',user.id).maybeSingle(),admin.from('candidate_link_access').select('paid_until').eq('user_id',user.id).maybeSingle(),admin.from('candidate_apply_unlocks').select('job_id',{count:'exact',head:true}).eq('user_id',user.id)]);
   check(prefs.error);check(access.error);check(unlocks.error);const paidUntil=access.data?.paid_until??null;
   return{email:user.email,passwordEnabled:user.passwordEnabled,providers:user.providers,productUpdates:prefs.data?.product_updates??false,membership:{paid:Boolean(paidUntil&&Date.parse(paidUntil)>Date.now()),paidUntil,remaining:Math.max(0,3-(unlocks.count??0)),purchasingEnabled:false}};
  },
  async preferences(user,value){if(!user.id)throw Error('Account mapping missing');const{error}=await admin.from('candidate_settings').upsert({user_id:user.id,product_updates:value,updated_at:new Date().toISOString()},{onConflict:'user_id'});check(error);},
  async removeData(user){
   check((await admin.from('candidate_deleted_identities').upsert({issuer,subject:user.subject},{onConflict:'issuer,subject',ignoreDuplicates:true})).error);
   if(!user.id)return;
   const lease=await admin.rpc('begin_resume_operation',{p_user_id:user.id,p_action:'remove'});check(lease.error);
   try{const storage=admin.storage.from('candidate-resumes');
   // Files are flat under the account UUID. Delete in batches without advancing an offset.
   for(let pass=0;pass<20;pass++){const{data,error}=await storage.list(user.id,{limit:100});check(error);if(!data?.length)break;check((await storage.remove(data.map(file=>user.id+'/'+file.name))).error);if(pass===19)throw Error('Cleanup needs another attempt');}
   const legacy=await admin.auth.admin.getUserById(user.id);if(legacy.error&&legacy.error.status!==404)throw Error('Legacy sign-in check failed');if(legacy.data.user)check((await admin.auth.admin.deleteUser(user.id)).error);
   const{error}=await admin.from('candidate_accounts').delete().eq('id',user.id);check(error);
   }finally{await admin.rpc('finish_resume_operation',{p_user_id:user.id,p_lease:lease.data});}
  },
  async cancelDeletion(user){
   // The main provider deadline may have expired. Use a fresh, short cleanup request.
   const retryAdmin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(5000)})}});
   check((await retryAdmin.from('candidate_deleted_identities').delete().eq('issuer',issuer).eq('subject',user.subject)).error);
  },
  async removeLogin(user:AccountIdentity){const response=await clerk('users/'+encodeURIComponent(user.subject),'DELETE');if(!response.ok&&response.status!==404)throw Error('Sign-in deletion incomplete');},
 },origins)(request);
});
