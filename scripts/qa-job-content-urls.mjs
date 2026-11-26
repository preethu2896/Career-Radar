import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {chromium,expect as baseExpect} from '@playwright/test';
const expect=baseExpect.configure({timeout:30000});const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const checks=[],errors=[];
try{
 const p=await b.newPage({reducedMotion:'reduce'});p.on('pageerror',e=>errors.push(e.message));await p.route('https://fonts.googleapis.com/**',r=>r.abort());await p.route('https://fonts.gstatic.com/**',r=>r.abort());
 await p.goto('http://localhost:5173/jobs',{waitUntil:'domcontentloaded'});await expect(p.locator('.sf-board-job').first()).toBeVisible();
 const href=await p.locator('.sf-board-job h3 a').first().getAttribute('href');assert.match(href,/^\/jobs\/[a-z0-9-]+\/[a-z0-9-]+$/);
 const samples=await p.evaluate(async()=>{const {loadOpportunities}=await import('/src/services/candidateWorkspace.ts');const {statedRequirements}=await import('/src/services/roleContent.ts');const {jobPath}=await import('/src/services/jobUrls.ts');const jobs=await loadOpportunities();return {first:{id:jobs[0].id,path:jobPath(jobs[0]),title:jobs[0].title},empty:jobs.filter(j=>statedRequirements(j).length===0).slice(0,1).map(j=>({path:jobPath(j),title:j.title})),titles:Object.fromEntries(jobs.map(j=>[jobPath(j),j.title]))};});
 for(const width of [1440,768,390,320]){
  await p.setViewportSize({width,height:900});await p.goto('http://localhost:5173'+href,{waitUntil:'domcontentloaded'});await expect(p.locator('.sf-role-title h1')).toHaveText(samples.titles[href]);
  assert.equal(await p.locator('.sf-role-title h1').evaluate(e=>getComputedStyle(e).fontSize),width<=760?'24px':'30px');
  const role=await p.locator('.sf-role-description .sf-description').innerText();assert.ok(!/^(?:about (?:the |this )?(?:role|team)|role overview)\s*:?$/im.test(role));
  for(const text of await p.locator('.sf-role-requirement-list dd').allTextContents())assert.ok(text.trim()&&!/^(not stated|unknown|n\/?a)$/i.test(text));
  assert.ok(!(await p.locator('.sf-role-facts').innerText()).includes('Not stated'));assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  const login=await p.getByRole('link',{name:'Sign in to apply',exact:true}).getAttribute('href');assert.equal(new URL(login,'http://localhost').searchParams.get('redirect'),href);await p.screenshot({path:`qa-artifacts/job-content-urls-${width}.png`,fullPage:false});checks.push({width,sourceTitlePreserved:true,compactTitle:true,noMissingRequirementRows:true,canonicalApplyRedirect:true});
 }
 for(const job of samples.empty){await p.goto('http://localhost:5173'+job.path,{waitUntil:'domcontentloaded'});await expect(p.locator('.sf-role-title h1')).toHaveText(job.title);await expect(p.locator('.sf-role-requirements')).toHaveCount(0);checks.push({emptyRequirementsHidden:true,path:job.path});}
 await p.goto('http://localhost:5173/jobs/'+samples.first.id,{waitUntil:'domcontentloaded'});await p.waitForURL(url=>url.pathname===samples.first.path);await expect(p.locator('.sf-role-title h1')).toHaveText(samples.first.title);await p.reload({waitUntil:'domcontentloaded'});await expect(p.locator('.sf-role-title h1')).toHaveText(samples.first.title);
 assert.deepEqual(errors,[]);await writeFile('qa-artifacts/job-content-urls-report.json',JSON.stringify({passed:true,checks,legacyLinkAndReload:true},null,2));console.log('PASS: canonical URLs, old-link redirects, exact source titles, smaller headings and provided-only requirements across desktop/mobile.');
}finally{await b.close();}
