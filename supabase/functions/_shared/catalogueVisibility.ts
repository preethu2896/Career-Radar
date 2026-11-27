/** Public browse responses never contain employer application or careers destinations. */
export function publicCatalogueView(value:any,{alreadyPublic=false}={}):any {
 const scrubText=(s:string)=>s.replace(/https?:\/\/[^\s<>"']+/gi,'').replace(/(?:mailto:)?[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'').replace(/href\s*=\s*["'][^"']*["']/gi,'');
 const walk=(v:any,key=''):any=>{
  if(v===null||v===undefined)return v;
  if(['application_url','source_url','sourceUrl','careerUrl','contact_email','contact_source_url','jobUrl','url','email'].includes(key))return null;
  if(['careerUrls','sourceUrls','suppliedSources','discovery_roots'].includes(key))return [];
  if(key==='website'){try{const u=new URL(v);return /(?:^|\.)(?:jobs|careers|boards|job-boards|lever|greenhouse|ashbyhq|workable|recruitee)\./i.test(u.hostname)||/(?:lever\.co|greenhouse\.io|ashbyhq\.com|workable\.com|recruitee\.com)$/i.test(u.hostname)?null:(u.protocol==='https:'||u.protocol==='http:'?u.origin:null);}catch{return null;}}
  if(typeof v==='string')return key==='logoUrl'||key==='company_logo_url'?(/^\/company-logos\//.test(v)?v:null):scrubText(v);
  if(Array.isArray(v))return v.map(x=>walk(x));
  if(typeof v==='object'){const out:any={};for(const[k,x]of Object.entries(v))out[k]=walk(x,k);if('source_url' in v && 'status' in v)out.has_verified_source=(alreadyPublic&&v.has_verified_source===true)||(typeof v.source_url==='string'&&/^https:\/\//.test(v.source_url));if(Array.isArray(v.careerUrls))out.hasCareerPortal=v.careerUrls.length>0||v.hasCareerPortal===true;return out;}
  return v;
 };return walk(value);
}
