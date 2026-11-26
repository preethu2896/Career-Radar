import {locationSuggestions} from './directoryPolicy.js';
type SearchCatalog={names:string[];locations:string[];industries:string[]};
let flight:Promise<SearchCatalog>|null=null;let cached:{data:SearchCatalog;at:number}|null=null;
export async function loadCompanySearchOptions():Promise<SearchCatalog>{
 if(cached&&Date.now()-cached.at<120000)return cached.data;
 flight??=(async()=>{const response=await fetch('/data/company-search-options.json',{cache:'no-store'});if(!response.ok)throw Error('Company suggestions could not be loaded.');const value=await response.json() as SearchCatalog;for(const field of ['names','locations','industries'] as const)if(!Array.isArray(value[field])||!value[field].every(item=>typeof item==='string'))throw Error('Invalid company suggestions.');const data={...value,locations:locationSuggestions(value.locations)};cached={data,at:Date.now()};return data;})();
 try{return await flight;}finally{flight=null;}
}
export async function loadCompanySearchNames(){return (await loadCompanySearchOptions()).names;}
