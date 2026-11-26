import {CareersAccess} from "./LinkAccess.js";
import {catalogueEnabled,catalogueCompany,catalogueRequest,type PublicJobPage} from '../services/publicCatalogueClient.js';
import {loadOpportunityList} from '../services/opportunityList.js';
import {primaryJobLocation} from '../services/directoryPolicy.js';
import {useEffect,useState} from 'react';
import {ArrowRight,ExternalLink,Bookmark,Check,LockKeyhole,ChevronDown} from 'lucide-react';
import {loadDiscoveryCompanies} from '../services/discoveryCompanies.js';
import {companyProfilePath,companySlug,companyPlace,parseCompanyProfilePath} from '../services/companyProfileUrls.js';
import {loadOpportunity,isRecentOpening,type Opportunity} from '../services/candidateWorkspace.js';
import type {LocalCompanyRecord} from '../services/localCompanyRepository.js';
import {loadSavedCompanies,setCompanySaved} from '../services/savedCompanies.js';
import {splitJobDescription} from '../services/jobDescription.js';
import {removeOpeningAboutHeading} from '../services/descriptionBlocks.js';
import {jobPath} from '../services/jobUrls.js';
import {safeExternalUrl} from '../domain/normalize.js';
import {useSiteAccount} from './SiteHeader.js';
import {CompanyLogo} from './CompanyLogo.js';
import {StructuredDescription} from './StructuredDescription.js';
import {CompanyProfileSkeleton} from './CompanySkeletons.js';
import './jobDetails.css';
import './companyProfile.css';

const nameKey=(name:string)=>name.trim().toLowerCase().replace(/\s+/g,' ');
const displayDate=(value:string|null)=>value&&Number.isFinite(Date.parse(value))?new Date(value).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}):null;
function virtualCompany(job:Opportunity):LocalCompanyRecord{return {id:'hiring-'+(job.feed_board_id??job.company_slug??job.id),identityKey:'live:'+nameKey(job.company_name),name:job.company_name,website:null,careerUrls:[],industry:null,headquarters:null,verificationStatuses:[],cityAssociations:[],sourceRows:[],roles:[],openingCounts:[],identityReviewStatuses:[],profilePath:companyProfilePath({name:job.company_name,location:job.location})};}
export function CompanyProfile({path}:{path:string}){
 const account=useSiteAccount();
 const [aboutExpanded,setAboutExpanded]=useState(false),[contactsExpanded,setContactsExpanded]=useState(()=>!matchMedia('(max-width:900px)').matches);
 useEffect(()=>{const media=matchMedia('(max-width:900px)');const update=()=>setContactsExpanded(!media.matches);media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
 const [data,setData]=useState<{company:LocalCompanyRecord|null;companies:LocalCompanyRecord[];jobs:Opportunity[];jobsError:boolean;jobsLoading?:boolean;total?:number;remote?:number}|null>(null);
 const [error,setError]=useState(false),[revision,setRevision]=useState(0),[limit,setLimit]=useState(15),[saved,setSaved]=useState(false),[saving,setSaving]=useState(false),[saveError,setSaveError]=useState(''),[moreLoading,setMoreLoading]=useState(false);
 useEffect(()=>{let active=true;setData(null);setError(false);setLimit(15);
  if(catalogueEnabled){const controller=new AbortController();void (async()=>{
   const result=await catalogueCompany(path);if(!active)return;
   if(!result.company){setData({company:null,companies:[],jobs:[],jobsError:false});return;}
   const company=result.company;setData({company,companies:[],jobs:[],jobsError:false,jobsLoading:true});
   document.title=company.name+' jobs & company details | CareerRadar';
   void catalogueRequest<{rows:LocalCompanyRecord[]}>('companies',{city:companyPlace(company).city,limit:7},controller.signal).then(related=>{if(active)setData(old=>old?{...old,companies:related.rows}:old);}).catch(()=>{});
   try{const page=await catalogueRequest<PublicJobPage>('jobs',{companyId:company.id,sort:'posted',limit:15},controller.signal);
    if(active)setData(old=>old?{...old,jobs:page.rows,total:page.total,jobsLoading:false}:old);
    if(!company.description&&page.rows[0])void loadOpportunity(page.rows[0].id).then(full=>{if(active&&full)setData(old=>old?{...old,jobs:old.jobs.map(job=>job.id===full.id?full:job)}:old);}).catch(()=>{});
   }catch{if(active)setData(old=>old?{...old,jobsError:true,jobsLoading:false}:old);}
  })().catch(()=>{if(active)setError(true);});return()=>{active=false;controller.abort();};}
  void Promise.allSettled([loadDiscoveryCompanies(),loadOpportunityList({force:revision>0})]).then(results=>{
   if(!active)return;const companies=results[0].status==='fulfilled'?results[0].value:[];const jobs=results[1].status==='fulfilled'?results[1].value.filter(job=>isRecentOpening(job)):[];
   const route=parseCompanyProfilePath(path);let company:LocalCompanyRecord|undefined;
   if(route){company=companies.find(c=>companyProfilePath(c)===path);if(!company){const matches=companies.filter(c=>companySlug(c.name)===route.company);if(matches.length===1)company=matches[0];}if(!company){const matching=jobs.filter(j=>companySlug(j.company_name)===route.company);if(matching.length){const linked=companies.filter(c=>c.feedBoardIds?.includes(matching[0]!.feed_board_id??''));company=linked.length===1?linked[0]:virtualCompany(matching[0]!);}}}
   else if(path.startsWith('/companies/hiring/')){const id=path.slice('/companies/hiring/'.length);const job=jobs.find(j=>j.feed_board_id===id);if(job){const linked=companies.filter(c=>c.feedBoardIds?.includes(job.feed_board_id??''));const matches=linked.length?linked:companies.filter(c=>nameKey(c.name)===nameKey(job.company_name));company=matches.length===1?matches[0]:virtualCompany(job);}}
   else {let id='';try{id=decodeURIComponent(path.slice('/companies/'.length));}catch{}company=companies.find(c=>c.id===id);}
   if(!company&&results.some(r=>r.status==='rejected')){setError(true);return;}
   const sameNamed=company?companies.filter(c=>nameKey(c.name)===nameKey(company!.name)):[];
   const companyJobs=company?jobs.filter(j=>company!.feedBoardIds?.includes(j.feed_board_id??'')||nameKey(j.company_name)===nameKey(company!.name)&&(sameNamed.length<=1||company!.identityKey.startsWith('live:')||company!.careerUrls.some(url=>{const career=safeExternalUrl(url),source=safeExternalUrl(j.source_url);return career&&source&&source.startsWith(career.replace(/\/$/, '')+'/');}))):[];
   setData({company:company??null,companies,jobs:companyJobs,jobsError:results[1].status==='rejected'});
   if(company){const canonical=companyProfilePath(company);if(window.location.pathname!==canonical)window.history.replaceState({},'',canonical+window.location.search);document.title=company.name+' jobs & company details | CareerRadar';if(!company.description&&companyJobs[0])void loadOpportunity(companyJobs[0].id).then(full=>{if(active&&full)setData(current=>current?{...current,jobs:current.jobs.map(job=>job.id===full.id?full:job)}:current);}).catch(()=>{});}
  }).catch(()=>{if(active)setError(true);});return()=>{active=false;};
 },[path,revision]);
 const company=data?.company;
 useEffect(()=>{let active=true;setSaved(false);setSaveError('');if(account.userId&&company)void loadSavedCompanies(account.userId).then(ids=>{if(active)setSaved(ids.includes(company.id));}).catch(()=>{if(active)setSaveError('Saved companies could not be loaded.');});return()=>{active=false;};},[account.userId,company?.id]);
 if(error)return <section className="sf-empty"><p className="cr-error" role="alert">Company details could not be loaded.</p><button className="auth-secondary" onClick={()=>setRevision(n=>n+1)}>Try again</button></section>;
 if(!data)return <CompanyProfileSkeleton/>;
 if(!company)return <section className="sf-empty"><h1>Company not found.</h1><a href="/companies">Explore companies</a></section>;
 const place=companyPlace(company);const jobs=[...data.jobs].sort((a,b)=>Date.parse(b.published_at??b.last_checked_at??'')-Date.parse(a.published_at??a.last_checked_at??''));
 const total=data.total??jobs.length;
 const remote=data.remote;
 const checked=jobs.map(j=>j.last_checked_at).filter((date):date is string=>Boolean(date)).sort().at(-1)??null;
 const overview=company.description||jobs.map(j=>splitJobDescription(j.description,company.name).companyText).find(Boolean);
 const canonical=companyProfilePath(company);const jobsUrl='/jobs?'+new URLSearchParams({company:jobs[0]?.company_name??company.name,...(catalogueEnabled?{companyId:company.id}:{})});
 const related=data.companies.filter(c=>c.id!==company.id&&companyPlace(c).city===place.city&&place.city!=='Unspecified').slice(0,6);
 const validPlace=[place.city,place.country].filter(v=>!['Unknown','Unspecified',''].includes(v));
 const locationTags=[...new Set(jobs.map(j=>primaryJobLocation(j.location)).filter(Boolean))].slice(0,5);
 const toggleSave=async()=>{if(!account.userId||saving)return;setSaving(true);setSaveError('');try{await setCompanySaved(account.userId,company.id,!saved);setSaved(!saved);}catch{setSaveError('Could not update saved company. Please retry.');}finally{setSaving(false);}};
 const saveControl=account.userId?<button className="auth-secondary" onClick={()=>void toggleSave()} disabled={saving}>{saved?<Check size={16}/>:<Bookmark size={16}/>} {saving?'Saving…':saved?'Saved · Remove':'Save company'}</button>:<a className="auth-secondary" href={'/login?redirect='+encodeURIComponent(canonical)}><Bookmark size={16}/>Sign in to save</a>;

 return <article className="sf-role-detail sf-company-profile">
  <div className="sf-company-profile-grid">
   <header className="sf-role-card sf-role-summary">
    <nav className="sf-role-breadcrumb" aria-label="Company breadcrumb"><a href="/companies">Companies</a>{place.country!=='Unknown'?<><span>/</span><span>{place.country}</span></>:null}{place.city!=='Unspecified'?<><span>/</span><a href={'/companies?city='+encodeURIComponent(place.city)}>{place.city}</a></>:null}<span>/</span><span aria-current="page">{company.name}</span></nav>
    <div className="sf-role-title"><CompanyLogo name={company.name} companyId={company.id} logoUrl={company.logoUrl} className="sf-role-logo"/><div><h1>{company.name}</h1><div className="sf-company-identity-meta">{validPlace.length?<span>{validPlace.join(', ')}</span>:null}{company.industry?<span>{company.industry}</span>:null}</div></div></div>
    <div className="sf-company-header-actions">{company.website?<a className="sf-company-official-link" href={safeExternalUrl(company.website)!} target="_blank" rel="noopener noreferrer">Website<ExternalLink size={14}/></a>:null}<CareersAccess key={(account.userId??'guest')+company.id} userId={account.userId} companyId={company.id} returnPath={canonical}/>{saveControl}</div>
    {saveError?<p className="cr-error" role="alert">{saveError}</p>:null}
    <div className="sf-company-opening-summary">{data.jobsLoading?<span role="status">Loading current openings…</span>:data.jobsError?<span>Current openings could not be checked.</span>:total>0?<><a href="#company-open-roles"><strong>{total}</strong> open {total===1?'role':'roles'}<ArrowRight size={14}/></a>{remote!==undefined&&remote>0?<span>{remote} marked remote</span>:null}{checked?<span>Checked {displayDate(checked)}</span>:null}</>:<p>No verified openings listed currently. Check the company’s careers page for other opportunities.</p>}</div>
   </header>
   <aside className="sf-company-profile-aside" aria-label="Founders and contacts">
    <details className="sf-role-card sf-company-contacts" open={contactsExpanded} onToggle={event=>setContactsExpanded(event.currentTarget.open)}>
     <summary><span><LockKeyhole size={17}/><span>Founders and contacts</span></span><span className="sf-company-soon">Coming soon</span><ChevronDown className="sf-contact-chevron" size={16}/></summary>
     <div className="sf-company-contacts-body"><p>Researched founder and hiring contacts, planned for Pro subscribers.</p><ul><li>Names and roles</li><li>Available work emails and LinkedIn profiles</li><li>Sources and last-checked dates</li></ul><p className="sf-hint">Not available to unlock yet. Contact details remain unpublished.</p></div>
    </details>
   </aside>
   <main className="sf-company-profile-main">
   {data.jobsLoading||data.jobsError||jobs.length>0?<section className="sf-role-card sf-company-openings" id="company-open-roles"><header><h2>Open roles</h2></header>
    {data.jobsLoading?<p role="status">Loading current openings…</p>:data.jobsError?<p className="cr-error" role="alert">Openings could not be loaded. <button className="cr-text-button" onClick={()=>setRevision(n=>n+1)}>Retry</button></p>:<>
     {locationTags.length>1?<div className="sf-company-role-tags" aria-label="Job locations">{locationTags.map(location=><span key={location}>{location}</span>)}</div>:null}
     <div className="sf-company-role-list">{jobs.slice(0,limit).map(job=><a key={job.id} href={jobPath(job)}><div><h3>{job.title}</h3><p>{[primaryJobLocation(job.location),job.employment_type].filter(Boolean).join(' · ')}</p></div>{job.published_at?<span>Posted {displayDate(job.published_at)}</span>:null}<ArrowRight className="sf-company-role-arrow" size={15}/></a>)}</div>
     <footer><span>Showing {Math.min(limit,total)} of {total}</span>{limit<total?<button className="auth-secondary" disabled={moreLoading} onClick={()=>{if(moreLoading)return;if(catalogueEnabled&&limit+15>jobs.length&&jobs.length<total){setMoreLoading(true);setSaveError('');void catalogueRequest<PublicJobPage>('jobs',{companyId:company.id,sort:'posted',offset:jobs.length,limit:15}).then(page=>{setData(old=>old?{...old,jobs:[...old.jobs,...page.rows.filter(row=>!old.jobs.some(job=>job.id===row.id))]}:old);setLimit(n=>n+15);}).catch(()=>setSaveError('More roles could not be loaded. Please retry.')).finally(()=>setMoreLoading(false));}else setLimit(n=>n+15);}}>{moreLoading?'Loading…':'Show more roles'}</button>:null}<a href={jobsUrl}>View on jobs board <ArrowRight size={14}/></a></footer>
    </>}
   </section>:null}
   {overview?<section className="sf-role-card sf-company-overview"><h2>About {company.name}</h2><div id="company-about-content" className={!aboutExpanded&&overview.length>600?'sf-company-about-preview':''}><StructuredDescription text={removeOpeningAboutHeading(overview,company.name)}/></div>{overview.length>600?<button className="cr-text-button" aria-expanded={aboutExpanded} aria-controls="company-about-content" onClick={()=>setAboutExpanded(value=>!value)}>{aboutExpanded?'Show less':'Read more'}<ChevronDown size={14}/></button>:null}{company.description?<p className="sf-hint sf-company-source-note">From company research; not independently verified.</p>:null}</section>:null}
  </main></div>
  {related.length?<section className="sf-role-card sf-company-explore"><h2>More companies in {place.city}</h2><p className="sf-hint">Based on directory location associations.</p><div>{related.map(c=><a href={companyProfilePath(c)} key={c.id}><CompanyLogo name={c.name} companyId={c.id} logoUrl={c.logoUrl}/><span>{c.name}</span><ArrowRight size={14}/></a>)}</div></section>:null}
 </article>;
}
