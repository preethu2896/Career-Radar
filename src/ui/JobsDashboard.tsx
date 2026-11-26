import './candidateWorkspace.css';
import {useEffect,useState} from 'react';
import {ArrowRight,Bookmark,Building2} from 'lucide-react';
import {useProtectedAuth} from './AuthFlows.js';
import {LoadingSkeleton} from './LoadingSkeleton.js';
import {loadApplications,type Application} from '../services/candidateWorkspace.js';
import {dashboardSummary} from '../services/dashboardSummary.js';
import {loadSavedCompanies} from '../services/savedCompanies.js';
import {catalogueEnabled,catalogueRequest} from '../services/publicCatalogueClient.js';
import {loadDiscoveryCompanies} from '../services/discoveryCompanies.js';
import {companyProfilePath} from '../services/companyProfileUrls.js';
import type {LocalCompanyRecord} from '../services/localCompanyRepository.js';
import {CompanyLogo} from './CompanyLogo.js';
import './profileSettings.css';
import './personalWorkspace.css';
type Followed={company:LocalCompanyRecord;openings:number|null};
export function JobsDashboardRoute({navigate}:{navigate:(path:string)=>void}){
 const auth=useProtectedAuth(navigate,'dashboard');
 if(auth.loading)return <main className="cr-loading"><LoadingSkeleton label="Loading your dashboard"/></main>;
 if(auth.error)return <main className="cr-loading"><p role="alert">{auth.error}</p><button className="auth-secondary" onClick={()=>window.location.reload()}>Try again</button></main>;
 return auth.userId&&auth.profile?<Dashboard key={auth.userId} userId={auth.userId} firstName={auth.profile.first_name}/>:null;
}
function Dashboard({userId,firstName}:{userId:string;firstName:string}){
 const[rows,setRows]=useState<Application[]|null>(null),[companies,setCompanies]=useState<Followed[]|null>(null),[savedCount,setSavedCount]=useState(0),[trackerError,setTrackerError]=useState(''),[companyError,setCompanyError]=useState(''),[revision,setRevision]=useState(0);
 useEffect(()=>{document.title='Your dashboard | CareerRadar';let active=true;const controller=new AbortController();setTrackerError('');setCompanyError('');
  void loadApplications(userId).then(value=>{if(active)setRows(value);}).catch(e=>{if(active)setTrackerError(e.message);});
  void(async()=>{const ids=await loadSavedCompanies(userId);if(!active)return;setSavedCount(ids.length);if(!ids.length){setCompanies([]);return;}
   const list=catalogueEnabled?(await catalogueRequest<{rows:LocalCompanyRecord[]}>('companies',{saved:JSON.stringify(ids.slice(0,500)),limit:6,sort:'name'},controller.signal)).rows:(await loadDiscoveryCompanies()).filter(c=>ids.includes(c.id)).slice(0,6);
   if(!active)return;setCompanies(list.map(company=>({company,openings:null})));
   if(catalogueEnabled&&list.length){try{const summary=await catalogueRequest<{rows:Array<{id:string;count:number}>}>('company_activity',{ids:JSON.stringify(list.map(c=>c.id))},controller.signal);if(active)setCompanies(list.map(company=>({company,openings:summary.rows.find(row=>row.id===company.id)?.count??0})));}catch{if(active)setCompanyError('Current opening counts could not be checked. You can still open a company.');}}
  })().catch(e=>{if(active)setCompanyError(e instanceof Error?e.message:'Saved companies could not be loaded.');});
  return()=>{active=false;controller.abort();};
 },[userId,revision]);
 const summary=rows?dashboardSummary(rows):null;
 const retry=()=>setRevision(value=>value+1);
 return <main className="cr-workspace cr-personal-page"><div className="cr-personal-container"><header className="cr-personal-heading"><div><h1>{firstName?'Your dashboard, '+firstName+'.':'Your dashboard.'}</h1><p>Your saved opportunities and next steps, in one place.</p></div><a href="/jobs" className="auth-primary">Explore jobs<ArrowRight size={16}/></a></header>
 {trackerError?<ErrorMessage message={trackerError} retry={retry}/>:!summary?<LoadingSkeleton label="Loading application summary" rows={3}/>:<><section className="cr-dashboard-stages" aria-label="Application summary">{(['Saved','Preparing','Applied','Interview','Offer'] as const).map(stage=><a key={stage} href={'/tracker?status='+encodeURIComponent(stage)}><span>{stage==='Interview'?'Interviewing':stage==='Offer'?'Offers':stage}</span><strong>{summary.counts[stage]}</strong><ArrowRight size={14}/></a>)}</section>{summary.total>=500?<p className="sf-hint">Summary of your 500 most recently updated records.</p>:null}</>}
 <div className="cr-dashboard-layout"><div><section className="cr-profile-section"><div className="cr-personal-section-heading"><h2>Continue your search</h2><a href="/tracker">Open tracker<ArrowRight size={14}/></a></div>{trackerError?<p>Your saved roles will appear when the tracker is available.</p>:!summary?<LoadingSkeleton label="Loading saved roles" rows={3}/>:summary.saved.length?<ul className="cr-personal-list">{summary.saved.map(row=><li key={row.id}><a href={'/tracker?application='+encodeURIComponent(row.id)}><span><strong>{row.title}</strong><small>{row.company_name}</small></span><span className="cr-personal-status">{row.status}</span><ArrowRight size={15}/></a></li>)}</ul>:<div className="cr-personal-empty"><Bookmark size={22}/><h3>Keep a role worth returning to.</h3><p>Save a job while browsing, or add a role you found elsewhere to your tracker.</p><div className="cr-personal-actions"><a href="/jobs" className="auth-primary">Explore jobs</a><a href="/tracker" className="auth-secondary">Add to tracker</a></div></div>}</section>
 <section className="cr-profile-section"><div className="cr-personal-section-heading"><h2>Recent activity</h2></div>{trackerError?<p>Activity is unavailable while the tracker is loading.</p>:!summary?<LoadingSkeleton label="Loading recent activity" rows={3}/>:summary.recent.length?<ul className="cr-personal-list">{summary.recent.map(row=><li key={row.id}><a href={'/tracker?application='+encodeURIComponent(row.id)}><span><strong>{row.title}</strong><small>{row.company_name} · {row.status} · Updated {new Date(row.updated_at).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</small></span><ArrowRight size={15}/></a></li>)}</ul>:<p>When you save or update an application, it will appear here.</p>}</section></div>
 <aside><section className="cr-profile-section"><div className="cr-personal-section-heading"><h2>Followed companies</h2>{savedCount>0?<a href="/companies?saved=1">View all ({savedCount})</a>:null}</div>{companyError?<ErrorMessage message={companyError} retry={retry}/>:null}{companies===null&&!companyError?<LoadingSkeleton label="Loading followed companies" rows={3}/>:companies?.length?<ul className="cr-personal-list cr-followed-list">{companies.map(({company,openings})=><li key={company.id}><a href={companyProfilePath(company)}><CompanyLogo name={company.name} companyId={company.id} logoUrl={company.logoUrl}/><span><strong>{company.name}</strong><small>{openings===null?'View company and openings':openings===0?'No verified openings currently':openings.toLocaleString()+' open '+(openings===1?'role':'roles')}</small></span><ArrowRight size={15}/></a></li>)}</ul>:companies?.length===0?<div className="cr-personal-empty"><Building2 size={22}/><h3>Keep companies on your radar.</h3><p>Save a company to find it here and check its current openings.</p><a href="/companies" className="auth-secondary">Explore companies</a></div>:null}</section>
 <section className="cr-profile-section"><h2>Job alerts</h2><p>Email alerts are coming soon. You can check your followed companies and saved roles here anytime.</p><a href="/settings#settings-notifications" className="cr-personal-link">Notification settings<ArrowRight size={14}/></a></section>
 <section className="cr-profile-section"><h2>Your profile</h2><p>Add preferences or a résumé when useful. Neither is required to browse or apply.</p><a href="/profile" className="cr-personal-link">Edit profile<ArrowRight size={14}/></a></section></aside></div>
 </div></main>;
}
function ErrorMessage({message,retry}:{message:string;retry:()=>void}){return <div className="cr-personal-feedback"><p className="cr-error" role="alert">{message}</p><button className="auth-secondary" onClick={retry}>Try again</button></div>;}
