import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {chromium,expect as baseExpect} from '@playwright/test';
const expect=baseExpect.configure({timeout:30000});const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const checks=[],errors=[];
try{
 const p=await b.newPage({reducedMotion:'reduce'});p.on('pageerror',e=>errors.push(e.message));await p.route('https://fonts.googleapis.com/**',r=>r.abort());await p.route('https://fonts.gstatic.com/**',r=>r.abort());
 await p.goto('http://localhost:5173/jobs?query=Zeta',{waitUntil:'domcontentloaded'});await expect(p.locator('.sf-board-job').first()).toBeVisible();const target=await p.locator('.sf-board-job h3 a').first().getAttribute('href');
 for(const width of [1440,768,390,320]){
  await p.setViewportSize({width,height:900});await p.goto('http://localhost:5173'+target,{waitUntil:'domcontentloaded'});await expect(p.locator('.sf-role-description')).toBeVisible();
  const role=await p.locator('.sf-role-description .sf-description').innerText();assert.ok(role.length>40);assert.ok(!role.includes('Zeta is a next-generation banking technology company'));assert.ok(!role.includes('Our Impact and Growth'));assert.ok(/legal|contracts|compliance|counsel|enterprise|application|security|support/i.test(role));
  await expect(p.locator('.sf-role-company')).toHaveCount(0);assert.ok(await p.getByRole('link',{name:'Sign in to apply',exact:true}).isVisible());assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  const companyHref=await p.locator('.sf-role-title>div>a').getAttribute('href');assert.ok(companyHref.startsWith('/companies/hiring/'));await p.locator('.sf-role-title>div>a').click();await expect(p.locator('.sf-company-overview .sf-description')).toBeVisible();
  const about=await p.locator('.sf-company-overview .sf-description').innerText();assert.ok(about.includes('Zeta'));assert.ok(about.includes('banking'));assert.ok(!about.includes('Requirements\n'));
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await p.screenshot({path:`qa-artifacts/company-overview-${width}.png`,fullPage:false});checks.push({width,roleTextSeparated:true,companyOverviewMoved:true,applyUnchanged:true});
 }
 assert.deepEqual(errors,[]);await writeFile('qa-artifacts/role-company-content-report.json',JSON.stringify({passed:true,target,checks},null,2));console.log('PASS: employer introduction appears only on company details; role responsibilities and Apply remain intact at four widths.');
}finally{await b.close();}
