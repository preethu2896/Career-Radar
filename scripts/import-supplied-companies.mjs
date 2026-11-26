import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parse} from 'csv-parse/sync';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const root='C:/Users/preet/Dropbox/PC/Downloads/';
const names=['remjobs-bengaluru-all-companies.csv','founders mail - Sheet1.csv','remjobs-bengaluru-all-jobs.csv'];
const input=await Promise.all(names.map(async name=>parse(await readFile(root+name,'utf8'),{columns:true,bom:true,skip_empty_lines:true})));
const [companies,founders,jobs]=input;
const clean=v=>{const s=String(v??'').trim();return /^(?:|[-–—]+|n\/?a|none|null|unknown|not (?:found|available|provided)|being confirmed(?:, locked)?|locked)$/i.test(s)?null:s;};
const key=v=>String(v??'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const url=v=>{try{const s=clean(v);if(!s||!/^https?:\/\/\S+$/i.test(s))return null;const u=new URL(s);return u.hostname.includes('.')&&!u.username&&!u.password?u.href:null;}catch{return null;}};
const domain=v=>{const s=url(v);return s?new URL(s).hostname.replace(/^www\./,''):null;};
const urls=v=>[...new Set((String(v??'').match(/https?:\/\/[^\s<>";,]+/g)??[]).map(x=>url(x.replace(/[).]+$/,''))).filter(Boolean))];
const emails=v=>[...new Set((String(v??'').match(/[A-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9.-]*[A-Z0-9])?\.[A-Z]{2,}/gi)??[]).map(x=>x.toLowerCase()))];
const rows=JSON.parse(await readFile('public/data/company-index.json','utf8'));
const oldIds=new Set(rows.map(x=>x.id));const sourceMap=new Map();const conflicts=[];
const stats={companyRows:companies.length,founderRows:founders.length,jobRows:jobs.length,addedCompanies:0,matchedCompanies:0,contactCompanies:0,ambiguousMatches:0};
function find(name,website){
 const named=rows.filter(r=>key(r.name)===key(name));const host=domain(website);
 const exact=host?named.filter(r=>domain(r.website)===host):named;
 if(exact.length===1)return exact[0];
 if(named.length===1&&(!host||!domain(named[0].website)))return named[0];
 const hosted=host?rows.filter(r=>domain(r.website)===host):[];
 if(hosted.length===1&&named.length===0)return hosted[0];
 if(named.length||hosted.length){conflicts.push({name,website,reason:'Ambiguous identity or conflicting website',candidateIds:[...new Set([...named,...hosted].map(r=>r.id))]});return null;}
 return undefined;
}
function make(name,website,tag){
 const identityKey=`supplied|${key(name)}|${domain(website)??'no-domain'}`;
 const row={id:createHash('sha256').update(identityKey).digest('hex').slice(0,20),identityKey,name,website,addedAt:new Date().toISOString(),careerUrls:[],industry:null,headquarters:null,verificationStatuses:['UNVERIFIED'],cityAssociations:[],sourceRows:[],roles:[],openingCounts:[],identityReviewStatuses:['NO_REVIEW_NEEDED']};
 rows.push(row);stats.addedCompanies++;return row;
}
function stamp(row,file){row.suppliedSources=[...new Set([...(row.suppliedSources??[]),file])];}
for(const [i,c] of companies.entries()){
 const name=clean(c.company_name);if(!name)throw Error(`Missing company name row ${i+2}`);
 const website=url(c.company_url);let row=find(name,website);if(row===null)continue;if(!row)row=make(name,website);else stats.matchedCompanies++;
 const prior=sourceMap.get(c.company_unique_number);if(prior&&prior!==row.id)throw Error('Duplicate source company number');sourceMap.set(c.company_unique_number,row.id);
 row.website??=website;row.description??=clean(c.about_the_company);
 const career=url(c.career_portal_url);if(career)row.careerUrls=[...new Set([...row.careerUrls,career])];
 if(!row.cityAssociations.some(x=>/^(bangalore|bengaluru)$/i.test(x.city??x.datasetCity??'')))row.cityAssociations.push({city:null,datasetCity:'Bengaluru',associationClass:'DATASET_ASSOCIATION',evidence:'User-supplied Bengaluru company CSV',evidenceUrl:null,notes:'Dataset association is not proof of an office location.',source:'SOURCE_DATASET'});
 stamp(row,names[0]);
}
for(const f of founders){
 const name=clean(f['Company Name']);if(!name)continue;let row=find(name,null);if(row===null)continue;if(!row)row=make(name,null);
 row.contacts={founderNames:clean(f.Founders),founderEmails:emails(f['Founders Mail']),founderLinkedIn:urls(f['Founders LinkedIn']).filter(x=>new URL(x).hostname.match(/(^|\.)linkedin\.com$/)),companyLinkedIn:urls(f['Company LinkedIn']).filter(x=>new URL(x).hostname.match(/(^|\.)linkedin\.com$/)),recruiterLinkedIn:urls(f['HR / Recruiters LinkedIn']).filter(x=>new URL(x).hostname.match(/(^|\.)linkedin\.com$/)),officeAddress:clean(f['Office Address']),verificationStatus:'UNVERIFIED',sourceFile:names[1]};
 const career=url(f['Career Page']);if(career)row.careerUrls=[...new Set([...row.careerUrls,career])];stamp(row,names[1]);stats.contactCompanies++;
}
const stagedJobs=jobs.map((j,i)=>({...j,sourceFile:names[2],sourceRow:i+2,companyId:sourceMap.get(j.company_unique_number)??null,status:'UNVERIFIED_IMPORT'}));
for(const j of stagedJobs){const c=companies.find(c=>c.company_unique_number===j.company_unique_number);if(!c||key(c.company_name)!==key(j.company_name))throw Error(`Job/company mismatch row ${j.sourceRow}`);}
stats.ambiguousMatches=conflicts.length;stats.totalCompanies=rows.length;stats.existingIdsPreserved=[...oldIds].every(id=>rows.some(r=>r.id===id));stats.stagedJobs=stagedJobs.length;stats.publishedJobs=0;
if(new Set(rows.map(x=>x.id)).size!==rows.length||!stats.existingIdsPreserved)throw Error('Company ID preservation failed');
await mkdir('qa-artifacts',{recursive:true});await writeFile('qa-artifacts/supplied-company-import-report.json',JSON.stringify({stats,conflicts},null,2));
if(process.argv.includes('--apply')){
 const privateDir=join(tmpdir(),'careerradar-private-company-import');
 await mkdir(privateDir,{recursive:true});
 // Keep the original snapshot for rollback; re-running never replaces it.
 try{await writeFile(join(privateDir,'company-index-before.json'),await readFile('public/data/company-index.json'),{flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;}
 await writeFile(join(privateDir,'unverified-jobs.json'),JSON.stringify(stagedJobs));
 await writeFile(join(privateDir,'private-founder-contacts.json'),JSON.stringify({sourceFile:names[1],sourceRows:founders,matched:rows.filter(r=>r.contacts).map(r=>({companyId:r.id,companyName:r.name,contacts:r.contacts}))}));
 // The user chose to keep contacts private: never ship them in static assets.
 const publicRows=rows.map(({contacts,...row})=>row);
 if(publicRows.some(r=>'contacts' in r))throw Error('Contact privacy boundary failed');
 await writeFile('public/data/company-index.json',JSON.stringify(publicRows));
 console.log('Private staging folder: '+privateDir);
}
console.log(JSON.stringify({mode:process.argv.includes('--apply')?'applied':'dry-run',stats,conflicts},null,2));
