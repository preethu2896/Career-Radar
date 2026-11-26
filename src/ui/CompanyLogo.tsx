import {useState} from 'react';
import {companyLogoUrl} from '../services/companyLogos.js';
import './companyLogo.css';

/** Decorative branding; adjacent company text provides the accessible name. */
export function CompanyLogo({name,companyId,logoUrl,className='sf-board-monogram'}:{name:string;companyId?:string|null|undefined;logoUrl?:string|null|undefined;className?:string}) {
 const source=companyLogoUrl(name,companyId,logoUrl);
 const [failedSource,setFailedSource]=useState<string|null>(null);
 const showImage=!!source&&source!==failedSource;
 return <span className={`${className} cr-company-logo${showImage?' has-logo':''}`} aria-hidden="true">
  {showImage?<img src={source} alt="" width={32} height={32} loading="lazy" decoding="async" onError={()=>setFailedSource(source)}/>:name.trim().charAt(0).toUpperCase()}
 </span>;
}
