import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {chromium,expect as baseExpect} from '@playwright/test';
const expect=baseExpect.configure({timeout:30000});const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const checks=[];
const words=text=>text.replace(/^\s*\d{1,2}[.)]\s+/gm,'').replace(/[’‘]/g,"'").toLowerCase().match(/[\p{L}\p{N}]+/gu)??[];
try{
 const p=await b.newPage({reducedMotion:'reduce'});await p.route('https://fonts.googleapis.com/**',r=>r.abort());await p.route('https://fonts.gstatic.com/**',r=>r.abort());
 for(const company of ['Zeta','HackerRank']){
  await p.goto('http://localhost:5173/jobs?query='+company,{waitUntil:'domcontentloaded'});await expect(p.locator('.sf-board-job').first()).toBeVisible();const path=await p.locator('.sf-board-job h3 a').first().getAttribute('href');
  for(const width of [1440,768,390,320]){
   await p.setViewportSize({width,height:900});await p.goto('http://localhost:5173'+path,{waitUntil:'domcontentloaded'});await expect(p.locator('.sf-role-description .sf-rich-description')).toBeVisible();
   const headings=await p.locator('.sf-role-description .sf-rich-description h3').allTextContents();const bullets=await p.locator('.sf-role-description .sf-rich-description li').count();assert.ok(headings.length>0,company+' headings');assert.ok(bullets>0,company+' bullets');
   const expected=await p.evaluate(async path=>{const {loadOpportunityByPath}=await import('/src/services/candidateWorkspace.ts');const {splitJobDescription}=await import('/src/services/jobDescription.ts');const {cleanRoleDescription}=await import('/src/services/roleContent.ts');const job=await loadOpportunityByPath(path);return cleanRoleDescription(splitJobDescription(job.description,job.company_name).roleText,job.title);},path);
   const actual=await p.locator('.sf-role-description .sf-rich-description').evaluate(el=>[...el.children].map(e=>e.matches('ul,ol')?[...e.children].map(li=>li.textContent).join('\n'):e.textContent).join('\n'));
   assert.deepEqual(words(actual),words(expected),'Company wording must be preserved');assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   const heading=p.locator('.sf-role-description .sf-rich-description h3').first();await heading.scrollIntoViewIfNeeded();await p.screenshot({path:`qa-artifacts/structured-description-${company}-${width}.png`,fullPage:false});checks.push({company,width,headings:headings.length,bulletItems:bullets,wordingPreserved:true,noOverflow:true});
  }
  await p.locator('.sf-role-title>div>a').click();await expect(p.locator('.sf-company-overview .sf-rich-description')).toBeVisible();const opening=await p.locator('.sf-company-overview .sf-rich-description').innerText();assert.ok(!/^About (?:us|the company|Zeta|HackerRank)\s*\n/i.test(opening));
 }
 await writeFile('qa-artifacts/structured-description-report.json',JSON.stringify({passed:true,checks,duplicateCompanyLabelsRemoved:true},null,2));console.log('PASS: actual employer headings and bullet lists at four widths, all source words preserved, duplicate opening company headings removed.');
}finally{await b.close();}
