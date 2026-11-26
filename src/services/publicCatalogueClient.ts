import type {Opportunity} from './candidateWorkspace.js';import type {JobFilters} from './discovery.js';import type {LocalCompanyRecord} from './localCompanyRepository.js';
export const catalogueUrl=import.meta.env.VITE_PUBLIC_CATALOGUE_URL?.trim()??'';
export const catalogueEnabled=Boolean(catalogueUrl);
export async function catalogueRequest<T>(action:string,values:Record<string,string|number|boolean|undefined>={}):Promise<T>{
 const url=new URL(catalogueUrl);url.searchParams.set('action',action);for(const[k,v]of Object.entries(values))if(v!==undefined&&v!=='')url.searchParams.set(k,String(v));
 const response=await fetch(url.href.length>2000?catalogueUrl:url,url.href.length>2000?{method:'POST',headers:{accept:'application/json','content-type':'application/json'},body:JSON.stringify({action,...values})}:{headers:{accept:'application/json'}});if(!response.ok)throw Error('Current catalogue could not be loaded. Please retry.');return response.json() as Promise<T>;
}
export type PublicJobPage={rows:Opportunity[];total:number;postedCounts:Record<string,number>};
export type PublicFacets={companies:Array<[string,number]>;featured:Array<{id?:string;logoUrl?:string|null;name:string;count:number;location:string|null}>;total:number;locations?:string[]};
let facetFlight:Promise<PublicFacets>|null=null,facets:{at:number;value:PublicFacets}|null=null;
export function catalogueFacets(){if(facets&&Date.now()-facets.at<60000)return Promise.resolve(facets.value);facetFlight??=catalogueRequest<PublicFacets>('facets').then(value=>{facets={at:Date.now(),value};return value;}).finally(()=>{facetFlight=null;});return facetFlight;}
export const catalogueJobs=(filters:JobFilters,offset=0)=>catalogueRequest<PublicJobPage>('jobs',{...filters,offset,limit:24});
export const catalogueCompany=(path:string)=>catalogueRequest<{company:LocalCompanyRecord|null}>('company',path.startsWith('/companies/')?{id:decodeURIComponent(path.slice(11))}:{path});
