import assert from 'node:assert/strict';
import { chromium, expect as baseExpect } from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const expect=baseExpect.configure({timeout:30000});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const checks=[];
try{
 const context=await browser.newContext({reducedMotion:'reduce'});
 await context.route('https://fonts.googleapis.com/**',r=>r.abort());await context.route('https://fonts.gstatic.com/**',r=>r.abort());
 const base={company_name:'QA Company',title:'QA Analyst',location:'Bengaluru',work_mode:'Hybrid',experience_requirement:'Freshers welcome',education_requirement:null,graduation_requirement:null,marks_requirement:null,salary:null,description:null,application_instructions:null,skills:['SQL'],source_url:'https://example.com/careers',application_url:null,contact_email:null,contact_source_url:null,source_kind:'OFFICIAL',status:'OPEN',published_at:new Date().toISOString(),first_seen_at:new Date().toISOString(),last_checked_at:new Date().toISOString()};
 const jobs=Array.from({length:20},(_,i)=>({...base,id:`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`,title:'QA Analyst '+i}));
 await context.route('**/rest/v1/career_opportunities*',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(jobs)}));
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const width of [1440,1024,768,390,320]){
  await page.setViewportSize({width,height:800});await page.goto('http://localhost:5173/jobs?query=SQL',{waitUntil:'domcontentloaded'});await expect(page.locator('.sf-board-job')).toHaveCount(20);
  const header=page.locator('header.sf-header'),logo=header.locator('.auth-logo');await expect(header.locator('nav')).toHaveCount(0);for(const href of ['/jobs','/companies','/radar','/applications','/about']){if(href!=='/jobs')await expect(header.locator(`a[href="${href}"]`)).toHaveCount(0);}
  assert.equal((await logo.textContent()).replace(/\s/g,''),'careerradar');assert.ok(await logo.evaluate(e=>parseFloat(getComputedStyle(e).fontSize)>=18));assert.ok(await logo.locator('span').evaluate(e=>parseFloat(getComputedStyle(e).fontSize)>=18));assert.equal(await logo.evaluate(e=>getComputedStyle(e,':before').content),'none');
  const before=page.url();await page.evaluate(()=>window.scrollTo({top:1000,behavior:'instant'}));assert.ok(await page.evaluate(()=>scrollY)>400);assert.ok(Math.abs(await header.evaluate(e=>e.getBoundingClientRect().top))<2,'Navbar did not remain reachable');await logo.click();await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(0);assert.equal(page.url(),before,'Logo changed the route or cleared search filters');await expect(page.locator('.sf-board-job')).toHaveCount(20);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:`qa-artifacts/navbar-${width}.png`,fullPage:false});checks.push({width,fullBrand:true,removedLinks:true,sticky:true,scrollToTop:true,routeAndFiltersPreserved:true});
 }
 await page.goto('http://localhost:5173/pricing',{waitUntil:'domcontentloaded'});await page.locator('.sf-header .auth-logo').click();await page.waitForURL(url=>url.pathname==='/jobs');await expect(page.locator('.sf-board')).toBeVisible();assert.deepEqual(errors,[]);await writeFile('qa-artifacts/navbar-report.json',JSON.stringify({passed:true,checks,otherPageLogoReturnsToJobs:true},null,2));console.log('PASS: full mobile brand, removed links, sticky header, Jobs scroll-to-top and preserved filters at five sizes');
}finally{await browser.close();}
