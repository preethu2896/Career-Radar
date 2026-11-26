import { parseFeed } from "./jobFeeds.ts";
type Role=Record<string,any>;
export async function enrichGreenhouseRole(job:Role,source:{provider:string;board_slug:string;source_job_id:string},fetcher:typeof fetch=fetch):Promise<Role>{
 if(source.provider!=='GREENHOUSE'||job.description||job.status!=='OPEN')return job;
 try{
  let slug=source.board_slug;try{slug=decodeURIComponent(slug);}catch{return job;}
  const url='https://boards-api.greenhouse.io/v1/boards/'+encodeURIComponent(slug)+'/jobs/'+encodeURIComponent(source.source_job_id);
  const response=await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(6000),headers:{accept:'application/json','user-agent':'CareerRadar/1.0 (public role details)'}});
  if(response.status===404||response.status===410){await response.body?.cancel();return{...job,status:'UNKNOWN',publication_state:'DRAFT'};}
  if(!response.ok){await response.body?.cancel();return job;}
  const reader=response.body?.getReader();if(!reader)return job;let text='',bytes=0;const decoder=new TextDecoder();try{while(true){const chunk=await reader.read();if(chunk.done)break;bytes+=chunk.value.byteLength;if(bytes>2000000)throw Error('ROLE_TOO_LARGE');text+=decoder.decode(chunk.value,{stream:true});}text+=decoder.decode();}finally{await reader.cancel();}
  const detail=JSON.parse(text);if(String(detail.id)!==source.source_job_id)return job;const checked=new Date().toISOString();const fresh=parseFeed({id:job.source_id,provider:'GREENHOUSE',board_slug:slug,company_name:job.company_name,scope:'WORLDWIDE'},{jobs:[detail],meta:{total:1}},checked).jobs[0];
  if(!fresh)return{...job,status:'UNKNOWN',publication_state:'DRAFT'};
  return{...job,...fresh,published_at:job.published_at??fresh.published_at,last_checked_at:checked};
 }catch{return job;}
}
