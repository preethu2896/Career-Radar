import {useEffect,useRef,useState} from 'react';
import {LockKeyhole,ExternalLink} from 'lucide-react';
import {requestLinkAccess,type LinkAccess} from '../services/linkAccess.js';
import {safeExternalUrl} from '../domain/normalize.js';
function useLinks(userId:string|null,kind:'job'|'company',id:string){
 const [access,setAccess]=useState<LinkAccess|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');const version=useRef(0);
 useEffect(()=>{const run=++version.current;setAccess(null);setError('');setBusy(Boolean(userId));if(userId)void requestLinkAccess(userId,kind,id).then(value=>{if(version.current===run)setAccess(value);}).catch(e=>{if(version.current===run)setError(e.message);}).finally(()=>{if(version.current===run)setBusy(false);});return()=>{version.current++;};},[userId,kind,id]);
 const load=async(consume=false)=>{if(!userId||busy)return;const run=version.current;setBusy(true);setError('');try{const value=await requestLinkAccess(userId,kind,id,consume);if(run===version.current)setAccess(value);}catch(e){if(run===version.current)setError(e instanceof Error?e.message:'Please retry.');}finally{if(run===version.current)setBusy(false);}};
 return{access,busy,error,unlock:()=>load(kind==='job'),retry:()=>load(false)};
}
export function CareersAccess({userId,companyId,returnPath}:{userId:string|null;companyId:string;returnPath:string}){
 const {access,busy,error,unlock}=useLinks(userId,'company',companyId);
 if(!userId)return <a className="sf-company-official-link" href={'/login?redirect='+encodeURIComponent(returnPath)}><LockKeyhole size={14}/>Careers · Sign in</a>;
 if(access?.unlocked)return <>{access.urls.filter(link=>safeExternalUrl(link.url)).map((link,i)=><a className="sf-company-official-link" key={i} href={safeExternalUrl(link.url)!} target="_blank" rel="noopener noreferrer">{link.label}<ExternalLink size={14}/></a>)}</>;
 return <><a className="sf-company-official-link" href="/pricing"><LockKeyhole size={14}/>{busy?'Checking access…':'Careers · Pro'}</a>{error?<span className="cr-error" role="alert">{error}{' '}<button className="cr-text-button" onClick={()=>void unlock()}>Retry</button></span>:null}</>;
}
export function JobApplyAccess({userId,jobId,returnPath,onOpen}:{userId:string|null;jobId:string;returnPath:string;onOpen:()=>void}){
 const{access,busy,error,unlock,retry}=useLinks(userId,'job',jobId);const url=access?.unlocked?safeExternalUrl(access.urls[0]?.url):null;
 return <>{!userId?<><a className="auth-primary" href={'/login?redirect='+encodeURIComponent(returnPath)}><LockKeyhole size={16}/>Sign in to unlock</a><p className="sf-hint">3 free job-apply unlocks after sign-up. Pro unlocks more applications and company careers links.</p></>:url?<a className="auth-primary" href={url} target="_blank" rel="noopener noreferrer" onClick={onOpen}>Apply on company site<ExternalLink size={16}/></a>:busy?<button className="auth-primary" disabled>Checking access…</button>:access&&access.remaining>0?<><button className="auth-primary" onClick={()=>void unlock()}><LockKeyhole size={16}/>Unlock apply link</button><p className="sf-hint">{access.remaining} free {access.remaining===1?'unlock':'unlocks'} left. This uses one unlock; reopening this job is free.</p></>:access?<><a className="auth-primary" href="/pricing"><LockKeyhole size={16}/>View Pro access</a><p className="sf-hint">Your 3 free unlocks are used. Paid subscriptions are not available to purchase yet.</p></>:null}{error?<p className="cr-error" role="alert">{error}{' '}<button className="cr-text-button" onClick={()=>void retry()}>Retry access check</button></p>:null}</>;
}
