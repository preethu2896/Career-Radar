export type AccountIdentity={id:string;subject:string;email:string;passwordEnabled:boolean;providers:string[]};
export type AccountBackend={
 authorize:(token:string)=>Promise<AccountIdentity|null>;
 read:(user:AccountIdentity)=>Promise<unknown>;
 preferences:(user:AccountIdentity,value:boolean)=>Promise<void>;
 removeData:(user:AccountIdentity)=>Promise<void>;
 removeLogin:(user:AccountIdentity)=>Promise<void>;
 cancelDeletion:(user:AccountIdentity)=>Promise<void>;
};
export function createAccountHandler(backend:AccountBackend,origins:string[]){
 return async(request:Request)=>{
  const origin=request.headers.get('origin');
  const headers:Record<string,string>={'content-type':'application/json','cache-control':'no-store, private','vary':'Origin, Authorization','access-control-allow-headers':'authorization,apikey,content-type,x-client-info','access-control-allow-methods':'POST,OPTIONS'};
  const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers});
  if(origin&&!origins.includes(origin))return json({error:'Origin is not allowed.'},403);
  if(origin)headers['access-control-allow-origin']=origin;
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='POST')return json({error:'Use POST.'},405);
  const token=/^Bearer (\S+)$/i.exec(request.headers.get('authorization')??'')?.[1];
  if(!token||token.length>16384)return json({error:'Sign in again to continue.'},401);
  try{
   const text=await request.text();if(text.length>4096)return json({error:'Request too large.'},400);
   let body:any;try{body=JSON.parse(text);}catch{return json({error:'Invalid request.'},400);}
   if(!body||typeof body!=='object'||!['read','preferences','delete'].includes(body.action))return json({error:'Invalid request.'},400);
   // The backend derives ownership from the verified token. A caller cannot select another account.
   if('userId' in body||'subject' in body||'accountId' in body)return json({error:'Invalid request.'},400);
   const user=await backend.authorize(token);if(!user)return json({error:'Sign in again to continue.'},401);
   if(body.action==='read')return json(await backend.read(user));
   if(body.action==='preferences'){
    if(typeof body.productUpdates!=='boolean')return json({error:'Choose a valid notification preference.'},400);
    await backend.preferences(user,body.productUpdates);return json({saved:true});
   }
   if(body.confirmation!=='DELETE'||typeof body.email!=='string'||body.email.trim().toLowerCase()!==user.email.toLowerCase()||!user.email)return json({error:'Enter your sign-in email and DELETE to confirm.'},400);
   // Remove private data first. If a provider fails, the still-active login can retry safely.
   try{await backend.removeData(user);}catch{await backend.cancelDeletion(user).catch(()=>{});return json({error:'Account deletion could not finish. Your sign-in is still active. Please retry.'},503);}
   try{await backend.removeLogin(user);}catch{await backend.cancelDeletion(user).catch(()=>{});return json({error:'Your CareerRadar data was removed, but sign-in deletion could not finish. Please retry.'},503);}
   return json({deleted:true});
  }catch{return json({error:'Account settings could not be updated. Please retry.'},503);}
 };
}
