import { catalogueCorsHeaders } from "./catalogueCors.ts";
import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { resolveCandidate } from "./identity.ts";
export async function catalogueAccess(request:Request,db:any,url:URL){
 const headers={...catalogueCorsHeaders,"content-type":"application/json","cache-control":"no-store, private","vary":"Authorization"};
 const json=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(request.method!=='POST')return json({error:'Use POST.'},405);
 const token=/^Bearer (\S+)$/i.exec(request.headers.get('authorization')??'')?.[1];if(!token)return json({error:'Sign in to continue.'},401);
 const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
 const origins=(Deno.env.get('CAREERRADAR_ALLOWED_ORIGINS')??'').split(',').map(x=>x.trim()).filter(Boolean);
 const userId=await resolveCandidate(admin,token,origins);if(!userId)return json({error:'Sign in again to continue.'},401);
 const kind=url.searchParams.get('kind'),id=url.searchParams.get('id')??'',consume=url.searchParams.get('consume')==='true';
 if(!['job','company'].includes(kind??'')||!id||id.length>160)return json({error:'Invalid access request.'},400);
 let record:any;
 if(kind==='job'){
  record=(await db.execute({sql:"SELECT j.application_url,j.source_url,j.status,s.enabled,s.last_success_at FROM catalogue_jobs j JOIN catalogue_sources s ON s.id=j.source_id WHERE j.id=?",args:[id]})).rows[0];
  if(!record||record.status!=='OPEN'||!record.enabled||String(record.last_success_at)<new Date(Date.now()-72*3600000).toISOString())return json({error:'This role needs a fresh source check.'},409);
  if(!/^https:\/\//.test(record.application_url??record.source_url??''))return json({error:'Application link unavailable.'},409);
 }else{
  record=(await db.execute({sql:'SELECT record_json FROM catalogue_companies WHERE id=?',args:[id]})).rows[0];if(!record)return json({error:'Company unavailable.'},404);
 }
 const {data,error}=await admin.rpc('check_candidate_link_access',{p_user_id:userId,p_job_id:kind==='job'?id:null,p_consume:kind==='job'&&consume});
 if(error)return json({error:'Access could not be checked. Please retry.'},503);
 const allowed=kind==='job'?data.unlocked:data.paid;
 const result:any={paid:data.paid,remaining:data.remaining,unlocked:allowed,urls:[]};
 if(allowed){if(kind==='job')result.urls=[{label:'Apply on company site',url:record.application_url||record.source_url}];else{const company=JSON.parse(record.record_json);const urls=[...new Set(company.careerUrls??[])].filter((v:any)=>typeof v==='string'&&/^https:\/\//.test(v));result.urls=urls.map((v:any,i:number)=>({label:urls.length===1?'Careers page':'Careers page '+(i+1),url:v}));}}
 return json(result);
}
