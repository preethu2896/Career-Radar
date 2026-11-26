import{catalogueEnabled,catalogueRequest}from'./publicCatalogueClient.js';
import {assignCompanyProfilePaths} from './companyProfileUrls.js';
import type { LocalCompanyRecord } from "./localCompanyRepository.js";
let cache: LocalCompanyRecord[] | null = null;
let flight: Promise<LocalCompanyRecord[]> | null = null;
export async function loadDiscoveryCompanies(): Promise<LocalCompanyRecord[]> {
  flight ??= (async () => {
    const response = await fetch("/data/discovery-companies.json", {cache:"no-store"});
    if (!response.ok) throw new Error("Company research could not be loaded.");
    cache = assignCompanyProfilePaths((await response.json()) as LocalCompanyRecord[]);
    return cache;
  })();
  try {
    return await flight;
  } finally {
    flight = null;
  }
}

export async function loadDiscoveryCompanyCount():Promise<number>{
 if(catalogueEnabled)return (await catalogueRequest<{companies:number}>('counts')).companies;
 const response=await fetch('/data/company-summary.json',{cache:'no-store'});
 if(!response.ok)throw new Error('Company count could not be loaded.');
 const summary=await response.json() as {total?:unknown};
 if(typeof summary.total!=='number'||!Number.isSafeInteger(summary.total)||summary.total<0)throw new Error('Invalid company count.');
 return summary.total;
}
