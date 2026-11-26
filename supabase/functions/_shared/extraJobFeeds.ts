import type {FeedBoard,FeedJob} from './jobFeeds.ts';
type Helpers={plainText:(v:unknown)=>string;url:(v:unknown)=>string;timestamp:(v:unknown,checkedAt:string)=>string|null;isIndiaLocation:(location:string,country?:unknown)=>boolean;experienceEvidence:(s:string)=>string|null;skills:(s:string)=>string[]};
const text=(v:unknown)=>typeof v==='string'?v.trim():'';
export function parseExtraFeed(board:FeedBoard,payload:any,checkedAt:string,h:Helpers):{jobs:FeedJob[];total:number}{
 const workable=board.provider==='WORKABLE';const input=workable?payload?.jobs:payload?.offers;
 if(!Array.isArray(input)||payload?.has_more===true||payload?.next||payload?.next_page||payload?.nextPage||(typeof payload?.total==='number'&&payload.total!==input.length))throw Error('INCOMPLETE_OR_INVALID_FEED');
 const grouped=new Map<string,any>();
 if(workable)for(const j of input){
  if(!j||typeof j!=='object'||!text(j.shortcode))throw Error('INVALID_JOB_RECORD');
  const prior=grouped.get(j.shortcode);const locations=Array.isArray(j.locations)&&j.locations.length?j.locations:[{city:j.city,country:j.country,region:j.state}];
  if(prior){if(prior.title!==j.title||prior.url!==j.url||prior.application_url!==j.application_url||text(prior.description)!==text(j.description))throw Error('CONFLICTING_DUPLICATE_JOB_ID');prior.locations=[...new Map([...prior.locations,...locations].map(location=>[JSON.stringify(location),location])).values()];}
  else grouped.set(j.shortcode,{...j,locations:[...locations]});
 }
 const records=workable?[...grouped.values()]:input;
 const ids=new Set<string>();const jobs:FeedJob[]=[];
 for(const j of records){if(!j||typeof j!=='object')throw Error('INVALID_JOB_RECORD');const id=workable?text(j.shortcode):typeof j.id==='number'?String(j.id):text(j.id);const title=text(j.title);
  if(!id||id.length>200||!title||title.length>200||ids.has(id))throw Error('INVALID_OR_DUPLICATE_JOB_ID');ids.add(id);
  if(!workable){if(typeof j.status!=='string')throw Error('MISSING_VISIBILITY_FLAG');if(j.status!=='published'||j.kind==='talent_pool')continue;if(j.close_at&&Number.isFinite(Date.parse(j.close_at))&&Date.parse(j.close_at)<=Date.parse(checkedAt))continue;}
  if(/\b(?:general (?:application|interest)|expression of interest|talent (?:pool|community|network)|future opportunities|join our talent|spontaneous application|unsolicited application|open application)\b/i.test(title))continue;
  if(j.locations!==undefined&&!Array.isArray(j.locations))throw Error('INVALID_JOB_LOCATION');
  const locations=Array.isArray(j.locations)&&j.locations.length?j.locations:[{city:j.city,country:workable?j.country:j.country_code||j.country,region:j.state||j.state_name}];
  const india=locations.filter((l:any)=>l&&l.hidden!==true&&h.isIndiaLocation([l.city,l.region,l.state,l.country].filter(Boolean).join(', '),l.countryCode||l.country_code||l.country)).map((l:any)=>[l.city,l.region||l.state,l.country].filter(Boolean).join(', '));
  if(!india.length)continue;
  let description=h.plainText(j.description);const requirements=h.plainText(j.requirements);if(requirements&&!description.includes(requirements))description+="\n\nRequirements\n"+requirements;
  const source=h.url(workable?j.url:j.careers_url);const application=h.url(workable?j.application_url||j.url:j.careers_apply_url||j.careers_url);
  const work_mode=workable?(j.telecommuting===true?'Remote':null):j.remote===true?'Remote':j.hybrid===true?'Hybrid':j.on_site===true?'Onsite':null;
  jobs.push({source_job_id:id,title,location:[...new Set(india)].join(' / '),work_mode,employment_type:text(workable?j.employment_type:j.employment_type_code)||null,experience_requirement:h.experienceEvidence(description)||text(workable?j.experience:j.experience_code)||null,description:description.trim().slice(0,60000),skills:h.skills(description),source_url:source,application_url:application,published_at:h.timestamp(workable?j.published_on:j.published_at,checkedAt)});
 }
 return {jobs,total:input.length};
}
