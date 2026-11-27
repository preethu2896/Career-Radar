import {readFile} from 'node:fs/promises';
import {createClient} from '@libsql/client/web';
const {TURSO_DATABASE_URL:url,TURSO_AUTH_TOKEN:authToken}=process.env;
if(!url||!authToken)throw Error('Load the existing private Turso environment file; never paste credentials into this script.');
const db=createClient({url,authToken});
try{
 const state=await db.execute("SELECT key,value FROM catalogue_meta WHERE key IN ('import_state','read_model')");
 if(!state.rows.some(row=>row.key==='import_state'&&row.value==='ready'))throw Error('Catalogue import must be complete before preparing the read model.');
 if(state.rows.some(row=>row.key==='read_model'&&row.value==='posted-days-v1')&&!process.argv.includes('--rebuild'))console.log('Read model already prepared. No rebuild performed.');
 else{
  const sql=await readFile(new URL('../catalogue/migrations/20261127_catalogue_read_model.sql',import.meta.url),'utf8');
  await db.executeMultiple(sql);
  console.log('Catalogue indexes and maintained daily counts prepared. Job records, IDs, source-check dates, contacts and user data are unchanged.');
 }
}catch(error){
 if(error&&error.code==='BLOCKED')console.error('Turso reads remain blocked. No further requests or upgrade attempted.');
 else console.error('Read model preparation failed. Check provider access and migration status before retrying.');
 process.exitCode=1;
}finally{db.close();}
