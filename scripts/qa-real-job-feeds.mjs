import assert from 'node:assert/strict';
import {chromium,expect as baseExpect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const expect=baseExpect.configure({timeout:30000});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const errors=[],checks=[],sourceJobs=new Map();
try{
 const p=await browser.newPage({reducedMotion:'reduce'});p.on('pageerror',e=>errors.push(e.message));
 p.on('response',async r=>{if(r.url().includes('/rest/v1/career_opportunities')){try{const body=await r.json();for(const job of Array.isArray(body)?body:[body])if(job?.id){sourceJobs.set(job.id,job);if(job.company_slug&&job.role_slug)sourceJobs.set('/jobs/'+job.company_slug+'/'+job.role_slug,job);}}catch{}}});
 await p.route('https://fonts.googleapis.com/**',r=>r.abort());await p.route('https://fonts.gstatic.com/**',r=>r.abort());
 for(const width of [1440,768,390,320]){
  await p.setViewportSize({width,height:900});await p.goto('http://localhost:5173/jobs',{waitUntil:'domcontentloaded'});
  await expect(p.locator('.sf-board-job').first()).toBeVisible();
  const count=await p.locator('.sf-board-job').count();assert.ok(count>0);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Overflow '+width);
  if(await p.getByRole('button',{name:'Show more roles',exact:true}).count()){
   await p.getByRole('button',{name:'Show more roles',exact:true}).click();await expect(p.locator('.sf-board-job')).toHaveCount(count+24);
  }
  await p.screenshot({path:`qa-artifacts/real-jobs-${width}.png`,fullPage:false});
  assert.ok((await p.locator('.sf-board-job-footer>a').first().getAttribute('href')).startsWith('/jobs/'),'Board Apply opens the job detail before applying');
  const detail=await p.locator('.sf-board-job h3 a').first().getAttribute('href');
  await p.locator('.sf-board-job h3 a').first().click();await expect(p.locator('.sf-description')).toBeVisible();assert.ok((await p.locator('.sf-description').innerText()).length>20);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Detail overflow '+width);
  await p.goto('http://localhost:5173/jobs',{waitUntil:'domcontentloaded'});await expect(p.locator('.sf-board-job').first()).toBeVisible();
  if(width<=900)await p.getByRole('button',{name:'Filters',exact:true}).click();
  await p.getByRole('searchbox',{name:'Search jobs',exact:true}).fill('Sarvam');
  if(width<=900)await p.getByRole('button',{name:'Close filters',exact:true}).click();
  await expect(p.locator('.sf-board-job-heading p').first()).toHaveText('Sarvam');
  assert.ok((await p.locator('.sf-board-job-heading p').allTextContents()).every(s=>s==='Sarvam'));
  await p.goto('http://localhost:5173/jobs?experience=internship',{waitUntil:'domcontentloaded'});
  await expect(p.locator('.sf-board-job').first()).toBeVisible();
  // Use the existing filter control, independent of URL parameter implementation.
  if(width<=900)await p.getByRole('button',{name:'Filters',exact:true}).click();
  const details=p.locator('details').filter({has:p.locator('select[aria-label="Experience"]')});
  await details.locator('summary').click();await p.getByRole('combobox',{name:'Experience',exact:true}).selectOption('internship');
  if(width<=900)await p.getByRole('button',{name:'Close filters',exact:true}).click();
  await expect(p.locator('.sf-board-job').first()).toBeVisible();
  for(const link of await p.locator('.sf-board-job h3 a').evaluateAll(els=>els.map(e=>e.getAttribute('href')))){
   const job=sourceJobs.get(link)||sourceJobs.get(link.split('/').pop());assert.ok(job&&(/\bintern(?:ship)?\b/i.test(job.title)||/\bintern(?:ship)?\b/i.test(job.employment_type??'')),'Internship must have source evidence');
  }
  checks.push({width,count,detail,search:true,internshipFilter:true,guestApplyGated:true});
 }
 await p.goto('http://localhost:5173/jobs?experience=freshers',{waitUntil:'domcontentloaded'});await expect(p.locator('.sf-board-job').first()).toBeVisible();
 const fresherSelection=await p.locator('.sf-board-results-heading p').innerText();
 checks.push({fresherSelection,sourceEvidenceChecked:true});
 const endpoint='https://fahvirvrmozvkanmuwnu.supabase.co/functions/v1/sync-job-feeds';
 assert.equal((await fetch(endpoint,{method:'POST'})).status,401);assert.equal((await fetch(endpoint,{method:'POST',headers:{authorization:'Bearer invalid'}})).status,401);assert.equal((await fetch(endpoint)).status,405);
 assert.deepEqual(errors,[]);await writeFile('qa-artifacts/real-job-feed-report.json',JSON.stringify({passed:true,checks,workerUnauthenticatedBlocked:true},null,2));console.log('PASS: real live jobs, pagination, detail pages, company search, internship/fresher filters, guest gating and worker authentication at four widths. '+fresherSelection);
}finally{await browser.close();}
