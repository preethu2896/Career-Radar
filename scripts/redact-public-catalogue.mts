import{readFile,writeFile,readdir}from'node:fs/promises';
import{publicCatalogueView}from'../supabase/functions/_shared/catalogueVisibility.ts';
for(const file of await readdir('public/data')){if(!file.endsWith('.json'))continue;const path='public/data/'+file;const value=JSON.parse(await readFile(path,'utf8'));await writeFile(path,JSON.stringify(publicCatalogueView(value)));console.log('Redacted public catalogue destinations:',file);}
