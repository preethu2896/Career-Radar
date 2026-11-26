import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {chromium,expect as baseExpect} from '@playwright/test';
const expect=baseExpect.configure({timeout:30000});
const privateDir=join(tmpdir(),'careerradar-private-company-import');
const before=JSON.parse(await readFile(join(privateDir,'company-index-before.json'),'utf8'));
const all=JSON.parse(await readFile('public/data/company-index.json','utf8'));
const compact=JSON.parse(await readFile('public/data/discovery-companies.json','utf8'));
const contacts=JSON.parse(await readFile(join(privateDir,'private-founder-contacts.json'),'utf8'));
assert.equal(new Set(all.map(r=>r.id)).size,all.length);
const byId=new Map(all.map(r=>[r.id,r]));for(const old of before){const current=byId.get(old.id);assert.ok(current);for(const field of ['identityKey','name','website','roles','openingCounts','sourceRows']){if(field==='website'&&!old.website)continue;assert.deepEqual(current[field],old[field],'Existing '+field+' preserved');}}
assert.equal(compact.length,all.length);
for(const rows of [all,compact])for(const r of rows)for(const field of ['contacts','founderNames','founderEmails','founderLinkedIn','recruiterLinkedIn','officeAddress'])assert.ok(!(field in r));
const privateEmails=contacts.matched.flatMap(c=>c.contacts.founderEmails);
for(const file of ['public/data/company-index.json','public/data/discovery-companies.json']){const text=await readFile(file,'utf8');for(const email of privateEmails)assert.ok(!text.toLowerCase().includes(email.toLowerCase()),'Founder email must remain private');}
const company=all.find(r=>r.name==='Explorex');assert.ok(company?.description);
const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const checks=[];
try{const p=await b.newPage({reducedMotion:'reduce'});await p.route('https://fonts.googleapis.com/**',r=>r.abort());await p.route('https://fonts.gstatic.com/**',r=>r.abort());
 for(const width of [1440,768,390,320]){
  await p.setViewportSize({width,height:900});await p.goto('http://localhost:5173/companies/'+company.id,{waitUntil:'domcontentloaded'});await expect(p.locator('.sf-detail h1')).toHaveText(company.name);
  await expect(p.locator('.sf-supplied-company .sf-rich-description')).toContainText(company.description);
  await expect(p.locator('.sf-detail')).toContainText('Historical research; current hiring needs checking.');
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow');
  assert.ok(await p.evaluate(()=>{const aside=document.querySelector('.sf-detail-layout>aside');const panel=aside.querySelector('.sf-action-panel');return panel.getBoundingClientRect().width>=aside.getBoundingClientRect().width-2;}),'Single sidebar panel fills the available width');
  for(const email of privateEmails)assert.ok(!(await p.locator('body').innerText()).includes(email));
  await p.screenshot({path:`qa-artifacts/company-import-${width}.png`});checks.push({width,descriptionVisible:true,noOverflow:true,privateContactsHidden:true});
 }
 await p.goto('http://localhost:5173/companies',{waitUntil:'domcontentloaded'});await p.getByPlaceholder('Name or industry').fill('Explorex');await expect(p.locator('.sf-company-list h2')).toContainText(['Explorex']);
 const deny=await p.request.get('http://localhost:5173/@fs/'+join(privateDir,'private-founder-contacts.json').replaceAll('\\','/'));assert.ok(deny.status()>=400,'Private staging must not be accessible through Vite');
 await writeFile('qa-artifacts/company-import-qa.json',JSON.stringify({passed:true,existingCompanyIdsPreserved:before.length,totalCompanies:all.length,addedCompanies:all.length-before.length,privateSourceContactRows:contacts.sourceRows.length,checks,privateStagingHttpStatus:deny.status()},null,2));console.log('PASS: company import, existing records preserved, private contacts absent from public assets, desktop/tablet/mobile layout and search.');
}finally{await b.close();}
