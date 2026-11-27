import {DatabaseSync} from 'node:sqlite';
import {writeFile} from 'node:fs/promises';
import {catalogueRead} from '../supabase/functions/_shared/publicCatalogue.ts';
import {PublicCatalogueCache,publicCatalogueCacheKey,publicCatalogueCacheAge} from '../supabase/functions/_shared/catalogueResponseCache.ts';
import {publicCatalogueView} from '../supabase/functions/_shared/catalogueVisibility.ts';

const [database,clock,output]=process.argv.slice(2);
if(!database||!clock||!Number.isFinite(Date.parse(clock)))throw Error('Usage: npx tsx scripts/benchmark-catalogue.mts <local.sqlite> <ISO-clock> [report.json]');
const now=new Date(clock),db=new DatabaseSync(database,{readOnly:true});
let statements=0;
const adapter={dailyCounts:db.prepare("SELECT value FROM catalogue_meta WHERE key='read_model'").get()?.value==='posted-days-v1',execute:async(s:any)=>{statements++;return{rows:db.prepare(s.sql).all(...s.args??[])};}};
const cache=new PublicCatalogueCache();
const queries=['action=jobs&limit=24','action=jobs&limit=24&offset=24','action=jobs&sort=posted','action=jobs&sort=company','action=jobs&experience=internship','action=jobs&experience=freshers&workMode=Onsite','action=jobs&query=python&location=India','action=companies&limit=24','action=companies&query=space','action=company_facets','action=facets'];
const results=[];
try{
 for(const query of queries){
  const url=new URL('https://catalogue.test/?'+query),start=performance.now(),before=statements;
  const value=await catalogueRead(adapter,url,now);
  const body=JSON.stringify(publicCatalogueView(value));
  cache.set(publicCatalogueCacheKey(url),body,publicCatalogueCacheAge(url.searchParams.get('action')!,value,now.getTime()),now.getTime());
  results.push({query,ms:Math.round(performance.now()-start),databaseStatements:statements-before,total:'total' in value?value.total:null,rows:'rows' in value?value.rows.length:null});
 }
 const before=statements;let hits=0;
 for(let visitor=0;visitor<20;visitor++)for(const query of queries){const url=new URL('https://catalogue.test/?'+query);if(cache.get(publicCatalogueCacheKey(url),now.getTime()+1000))hits++;else await catalogueRead(adapter,url,now);}
 const report={clock:now.toISOString(),readModel:adapter.dailyCounts,results,warmSimulation:{visitors:20,requests:20*queries.length,cacheHits:hits,databaseStatements:statements-before},limits:'Local execution time and statement counts only. This is not billable Turso row-read measurement or a concurrency/load-capacity guarantee. The supplied clock tests the backup as it was; it does not refresh any jobs.'};
 if(output)await writeFile(output,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{db.close();}
