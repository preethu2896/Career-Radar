import type {Opportunity} from './candidateWorkspace.js';import type {JobFilters} from './discovery.js';import type {LocalCompanyRecord} from './localCompanyRepository.js';
export const catalogueUrl=import.meta.env.VITE_PUBLIC_CATALOGUE_URL?.trim()??'';
export const catalogueEnabled=Boolean(catalogueUrl);
export async function catalogueRequest<T>(action:string,values:Record<string,string|number|boolean|undefined>={},signal?:AbortSignal):Promise<T>{
 const url=new URL(catalogueUrl);url.searchParams.set('action',action);for(const[k,v]of Object.entries(values))if(v!==undefined&&v!=='')url.searchParams.set(k,String(v));
 const deadline=AbortSignal.timeout(20000);const requestSignal=signal?AbortSignal.any([signal,deadline]):deadline;
 try{const response=await fetch(url.href.length>2000?catalogueUrl:url,url.href.length>2000?{signal:requestSignal,method:'POST',headers:{accept:'application/json','content-type':'application/json'},body:JSON.stringify({action,...values})}:{signal:requestSignal,headers:{accept:'application/json'}});if(!response.ok)throw Error('Current catalogue could not be loaded. Please retry.');return await response.json() as T;}catch(error){if(deadline.aborted&&!signal?.aborted)throw Error('The catalogue is taking too long. Please retry.');throw error;}
}
export type PublicJobPage={rows:Opportunity[];total:number;postedCounts:Record<string,number>};
export type PublicFacets={companies:Array<[string,number]>;featured:Array<{id?:string;logoUrl?:string|null;name:string;count:number;location:string|null}>;total:number;locations?:string[]};
let facetFlight:Promise<PublicFacets>|null=null,facets:{at:number;value:PublicFacets}|null=null;
export function catalogueFacets(){if(facets&&Date.now()-facets.at<60000)return Promise.resolve(facets.value);facetFlight??=catalogueRequest<PublicFacets>('facets').then(value=>{facets={at:Date.now(),value};return value;}).finally(()=>{facetFlight=null;});return facetFlight;}
export const catalogueJobs=(filters:JobFilters,offset=0,signal?:AbortSignal)=>catalogueRequest<PublicJobPage>('jobs',{...filters,offset,limit:24},signal);
export const catalogueCompany=(path:string)=>catalogueRequest<{company:LocalCompanyRecord|null}>('company',path.startsWith('/companies/')?{id:decodeURIComponent(path.slice(11))}:{path});
