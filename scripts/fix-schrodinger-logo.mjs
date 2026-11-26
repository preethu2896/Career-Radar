import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const sourceUrl='https://www.schrodinger.com/wp-content/themes/bigdrop-theme/dist/images/favicon/apple-icon.png';
const r=await fetch(sourceUrl,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error('Could not load confirmed icon');const bytes=Buffer.from(await r.arrayBuffer());if(bytes[0]!==137||bytes[1]!==80)throw new Error('Not a PNG');
await writeFile('public/company-logos/schrodinger.png',bytes);
const manifest=JSON.parse(await readFile('data/company-logo-sources.json','utf8'));const logo=manifest.find(m=>m.company==='Schrödinger');logo.domain='www.schrodinger.com';logo.sourceUrl=sourceUrl;logo.sha256=createHash('sha256').update(bytes).digest('hex');await writeFile('data/company-logo-sources.json',JSON.stringify(manifest,null,2)+'\n');
