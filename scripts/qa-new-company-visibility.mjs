import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium,expect as baseExpect} from '@playwright/test';
const expect=baseExpect.configure({timeout:30000});
const rows=JSON.parse(await readFile('public/data/discovery-companies.json','utf8'));const added=rows.filter(r=>r.addedAt);assert.equal(added.length,395);
const addedIds=new Set(added.map(r=>r.id));const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const checks=[];
try{const p=await b.newPage({reducedMotion:'reduce'});await p.route('https://fonts.googleapis.com/**',r=>r.abort());await p.route('https://fonts.gstatic.com/**',r=>r.abort());
 for(const width of [1440,768,390,320]){await p.setViewportSize({width,height:900});await p.goto('http://localhost:5173/companies',{waitUntil:'domcontentloaded'});await expect(p.locator('p[role=status]')).toContainText('9,568');
  for(const href of await p.locator('.sf-company-list h2 a').evaluateAll(elements=>elements.map(a=>a.getAttribute('href'))))assert.ok(addedIds.has(href.slice('/companies/'.length)),'New companies appear first');
  await p.getByLabel('Newly added (395)').check();await expect(p.locator('p[role=status]')).toContainText('395');assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await p.screenshot({path:`qa-artifacts/new-companies-${width}.png`});await p.locator('.sf-company-list h2 a').first().click();await expect(p.locator('.sf-detail h1')).toBeVisible();checks.push({width,importedCompaniesFirst:true,filterCount:395,detailWorks:true,noOverflow:true});
 }
 await p.goto('http://localhost:5173/companies?added=1',{waitUntil:'domcontentloaded'});await expect(p.getByLabel('Newly added (395)')).toBeChecked();await expect(p.locator('p[role=status]')).toContainText('395');
 await writeFile('qa-artifacts/new-company-visibility.json',JSON.stringify({passed:true,checks},null,2));console.log('PASS: all 395 new companies exposed through directory filter; newest records first; detail links and direct filter URL work at four widths.');
}finally{await b.close();}
