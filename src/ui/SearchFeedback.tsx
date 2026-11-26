export function SearchFeedback({query,count,loading,error,filtered=false,kind}:{query:string;count:number;loading:boolean;error:string;filtered?:boolean;kind:'jobs'|'companies'}){
 if(!query.trim()&&!filtered)return null;
 return <p className="sf-search-feedback" role="status" aria-live="polite" aria-atomic="true">{loading?'Searching…':error?'Search could not be completed.':<>{count.toLocaleString()} {kind==='jobs'?(count===1?'job':'jobs'):(count===1?'company':'companies')}{query.trim()?<> for “{query.trim()}”</>:<> match your filters</>}</>}</p>;
}
export function SearchMatch({text,query}:{text:string;query:string}){
 const needle=query.trim();if(!needle)return <>{text}</>;
 const at=text.toLocaleLowerCase().indexOf(needle.toLocaleLowerCase());
 return at<0?<>{text}</>:<>{text.slice(0,at)}<mark className="sf-search-match">{text.slice(at,at+needle.length)}</mark>{text.slice(at+needle.length)}</>;
}
