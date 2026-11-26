import {canonicalLocation} from './directoryPolicy.js';
export type CompanyLocationRecord={id?:string;country?:string|null;city?:string|null;name:string;profilePath?:string|undefined;headquarters?:string|null;location?:string|null;cityAssociations?:Array<{city?:string|null;datasetCity?:string|null}>};
export function companySlug(value:string){return value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'company';}
const cities=['Bengaluru','Mumbai','Pune','Hyderabad','Chennai','Delhi NCR','Noida','Gurugram','Kolkata','Ahmedabad','Jaipur','Indore','Kochi','Coimbatore','Chandigarh','Bhopal','Bhubaneswar','Guwahati','Lucknow','Madurai','Mangalore','Mysuru','Nagpur','Surat','Thiruvananthapuram','Udupi','Visakhapatnam','Manipal'];
export function companyCity(value:string|null|undefined):string|null{
 if(!value)return null;const text=canonicalLocation(value).replace(/gurgaon/ig,'Gurugram').replace(/mysore/ig,'Mysuru').replace(/mangaluru/ig,'Mangalore');
 const found=cities.filter(city=>text.toLowerCase().includes(city.toLowerCase())).sort((a,b)=>text.toLowerCase().indexOf(a.toLowerCase())-text.toLowerCase().indexOf(b.toLowerCase()))[0];
 return found??(/\bremote\b/i.test(text)?'Remote':null);
}
export function companyPlace(company:CompanyLocationRecord){
 if(company.country)return {country:company.country,city:company.city||'Unspecified'};
 const associated=company.cityAssociations?.map(r=>r.city||r.datasetCity).find(Boolean);
 const city=companyCity(associated)||companyCity(company.location)||companyCity(company.headquarters);
 return {country:city||/\bindia\b/i.test(company.location??company.headquarters??'')?'India':'Unknown',city:city||'Unspecified'};
}
export function companyProfilePath(company:CompanyLocationRecord){if(company.profilePath)return company.profilePath;const place=companyPlace(company);return `/jobs/${companySlug(place.country)}/${companySlug(place.city)}/${companySlug(company.name)}`;}
export function assignCompanyProfilePaths<T extends CompanyLocationRecord>(rows:T[]):Array<T&{profilePath:string}>{
 const groups=new Map<string,T[]>();for(const row of rows){const path=companyProfilePath({...row,profilePath:undefined});groups.set(path,[...(groups.get(path)??[]),row]);}
 return rows.map(row=>{const base=companyProfilePath({...row,profilePath:undefined});return {...row,profilePath:row.profilePath||(groups.get(base)!.length===1?base:base+'-'+row.id)};});
}
export function parseCompanyProfilePath(path:string){try{const parts=path.split('/').filter(Boolean).map(decodeURIComponent);return parts.length===4&&parts[0]==='jobs'&&parts.slice(1).every(p=>p.length<=250&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p))?{country:parts[1]!,city:parts[2]!,company:parts[3]!}:null;}catch{return null;}}
