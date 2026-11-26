export const CITY_SUGGESTIONS:readonly string[]=['Bengaluru','Mumbai','Pune','Hyderabad','Chennai','Delhi NCR','Noida','Gurugram','Kolkata','Ahmedabad','Jaipur','Indore','Kochi','Coimbatore','Chandigarh','Bhopal','Bhubaneswar','Guwahati','Lucknow','Madurai','Mangalore','Mysuru','Nagpur','Surat','Thiruvananthapuram','Udupi','Visakhapatnam','Manipal','Remote'];
const LOCATION_ALIASES: Record<string,string> = {
  bangalore:'Bengaluru',bengalore:'Bengaluru',banglore:'Bengaluru',bengluru:'Bengaluru',bangluru:'Bengaluru',bengaluru:'Bengaluru',
  gurgaon:'Gurugram',gurugram:'Gurugram',bhubaneshwar:'Bhubaneswar',bhubaneswar:'Bhubaneswar',orissa:'Odisha',odisha:'Odisha',uttrakhand:'Uttarakhand',uttarakhand:'Uttarakhand',keralam:'Kerala',kerala:'Kerala',vizag:'Visakhapatnam',visakhapatnam:'Visakhapatnam',
};
const REGION_NAMES=['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','West Bengal','Delhi NCR','India','Remote',...CITY_SUGGESTIONS];
const LOCATION_NAMES = new Map(REGION_NAMES.map(name=>[name.toLowerCase(),name]));
export function canonicalLocation(value:string|null|undefined):string{
  return (value??'').normalize('NFD').replace(/[\u0300-\u036f\u200b-\u200d\ufeff]/g,'')
    .replace(/\(\s*(?:hybrid|remote|on[ -]?site|in[ -]?office)\s*\)/gi,'')
    .replace(/\bDelhi[ -]+NCR\b/gi,'Delhi NCR')
    .replace(/\b(?:bangalore|bengalore|banglore|bengluru|bangluru|bengaluru|gurgaon|gurugram|bhubaneshwar|bhubaneswar|orissa|odisha|uttrakhand|uttarakhand|keralam|kerala|vizag|visakhapatnam)\b/gi,word=>LOCATION_ALIASES[word.toLowerCase()]!)
    .replace(/\s+/g,' ').trim();
}
// A location picker lists places, not office codes or working arrangements.
export function locationSuggestions(values:readonly string[]):string[]{
  const places=new Map<string,string>();
  for(const value of values)for(let part of canonicalLocation(value).split(/[,;|/]/)){
    part=part.replace(/[()]/g,' ').replace(/^[\s]+|[\s.]+$/g,'')
      .replace(/^(?:hybrid|on[ -]?site|in[ -]?office|remote)\s+(?:in\s+|-\s*)?/i,'')
      .replace(/\s+(?:hybrid|on[ -]?site|remote)$/i,'')
      .replace(/^(?:IND?|India)\s*-\s*/i,'').replace(/\s*-\s*India$/i,'').trim();
    if(/^KA$/i.test(part))part='Karnataka';
    if(/^IN$/i.test(part))part='India';
    const city=CITY_SUGGESTIONS.find(name=>{
      const prefix=part.slice(0,name.length);
      return prefix.toLowerCase()===name.toLowerCase()&&/^(?:\s+(?:Office|HQ)|\s*-\s*(?:DD|EC|WF|VTP))?$/i.test(part.slice(name.length));
    });
    const name=city??LOCATION_NAMES.get(part.toLowerCase())??part;
    if(!name||name.length>70||/^\[.*\]$/.test(name)||/\b(?:HQ|office)\b/i.test(name))continue;
    places.set(name.toLowerCase(),name);
  }
  return [...places.values()].sort((a,b)=>a.localeCompare(b));
}
export function normalizeSearchText(value:string|null|undefined):string{return canonicalLocation(value).toLowerCase().replace(/\s+/g,' ').trim();}
export function isBengaluruPrefix(value:string){const text=value.toLowerCase().trim();return text.length>=3&&['bangalore','bengalore','banglore','bengluru','bangluru','bengaluru'].some(alias=>alias.startsWith(text));}
type PortalRecord={website?:string|null;careerUrls?:string[];sourceRows?:Array<{careerUrl?:string|null}>};
function validUrl(value:string|null|undefined){try{const url=new URL(value??'');return ['https:','http:'].includes(url.protocol)&&url.hostname.includes('.')&&!url.username&&!url.password?url:null;}catch{return null;}}
export function careerPortalLinks(company:PortalRecord):string[]{
 const website=validUrl(company.website);const explicit=new Set((company.sourceRows??[]).map(row=>row.careerUrl).filter((url):url is string=>Boolean(url)));
 const candidates=[...(company.careerUrls??[]),...explicit];const accepted:string[]=[];
 for(const value of candidates){const url=validUrl(value);if(!url)continue;const host=url.hostname.toLowerCase();let path=url.pathname.toLowerCase();try{path=decodeURI(path);}catch{}
  const knownHost=/(?:^|\.)(?:careers?|jobs?|hiring|recruitment|ats)\./.test(host)||/(?:greenhouse\.io|lever\.co|ashbyhq\.com|workable\.com|recruitee\.com|teamtailor\.com|keka\.com|zohorecruit\.(?:com|in)|myworkdayjobs\.com|breezy\.hr|rippling\.com|smartrecruiters\.com|recruitcrm\.io|bamboohr\.com|applytojob\.com|freshteam\.com|recruiterbox\.com|darwinbox\.in|talentlyft\.com|pinpointhq\.com|jobvite\.com|icims\.com|oraclecloud\.com|successfactors\.com)$/.test(host);
  const careerPath=/(?:^|\/)(?:careers?|jobs?|join[-_]?us|work[-_]?with[-_]?us|opportunities|vacancies|openings|positions|recruitment|hiring)(?:\/|[-_?.]|$)/.test(path)||/(?:^|[#?&=/])(?:careers?|jobs?|join-us|openings)(?:$|[=&/])/.test((url.hash+url.search).toLowerCase());
  const nonCareer=/\.(?:pdf|png|jpe?g|svg|webp|css|js)$/.test(path)||/(?:^|\/)(?:privacy|terms|news|blog|in)(?:\/|$)/.test(path)||(!careerPath&&/(?:^|\/)(?:about|contact)(?:\/|$)/.test(path));
  const home=website&&url.hostname.replace(/^www\./,'')===website.hostname.replace(/^www\./,'')&&url.pathname.replace(/\/$/,'')===website.pathname.replace(/\/$/,'');
  const suppliedPage=explicit.has(value)&&path!=='/'&&!home&&!nonCareer&&!/(?:^|\.)linkedin\.com$/.test(host);
  if(!nonCareer&&(knownHost||careerPath||suppliedPage)&&!accepted.includes(url.href))accepted.push(url.href);
 }
 return accepted;
}
export function hasCareerPortal(company:PortalRecord & {hasCareerPortal?:boolean}){return company.hasCareerPortal===true||careerPortalLinks(company).length>0;}

// Keep source order when a listing names several offices; do not alphabetize its main location.
export function primaryJobLocation(value:string|null|undefined):string{
 const canonical=canonicalLocation(value);
 const groups=canonical.split(/\s*(?:;|\/)\s*/);
 const india=groups.filter(group=>/\b(?:India|Bengaluru|Mumbai|Hyderabad|Chennai|Delhi|Pune|Kolkata|Gurugram|Noida)\b/i.test(group));
 const places=(india.length?india.join(' / '):canonical).split(/[,;|/]/).flatMap(part=>locationSuggestions([part]));
 return places.find(place=>!['India','IN','Remote'].includes(place))??places.find(place=>place==='India')??places[0]??'';
}
