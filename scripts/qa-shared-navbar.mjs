import assert from 'node:assert/strict';
import {chromium,expect as baseExpect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const expect=baseExpect.configure({timeout:30000});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const checks=[],errors=[];
try{
 const context=await browser.newContext({reducedMotion:'reduce'});await context.route('https://fonts.googleapis.com/**',r=>r.abort());await context.route('https://fonts.gstatic.com/**',r=>r.abort());const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://localhost:5173/jobs',{waitUntil:'domcontentloaded'});await expect(p.locator('.cr-site-navbar')).toBeVisible();
 for(const width of [1440,390]){await p.setViewportSize({width,height:900});for(const path of ['/','/about','/jobs','/companies','/pricing','/applications','/account','/terms','/privacy','/login','/signup','/forgot-password','/reset-password','/not-a-route','/companies/not-a-company','/jobs/00000000-0000-4000-8000-000000000000']){
   await p.evaluate(path=>{history.pushState({},'',path);dispatchEvent(new PopStateEvent('popstate'));},path);await expect.poll(()=>p.evaluate(()=>location.pathname)).toBe(path);await p.locator('.page-transition').waitFor();
   const header=p.locator('.cr-site-navbar');await expect(header).toHaveCount(1);await expect(header).toBeVisible();assert.equal((await header.locator('.auth-logo').textContent()).replace(/\s/g,''),'careerradar');await expect(header.getByRole('link',{name:'Pricing',exact:true})).toBeVisible();await expect(header.getByRole('link',{name:'Sign in',exact:true})).toBeVisible();await expect(p.locator('.landing-nav,.cr-workspace-header,.not-found-header,.dashboard-topbar,.cr-setup-top')).toHaveCount(0);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Overflow at '+path+' '+width);assert.ok(await header.evaluate(e=>Math.abs(e.getBoundingClientRect().top)<2));checks.push({path,width,sharedHeader:true});
   if(['/','/login','/signup','/pricing'].includes(path))await p.screenshot({path:`qa-artifacts/shared-navbar-${path==='/'?'home':path.slice(1)}-${width}.png`,fullPage:false});
 }}
 await p.setViewportSize({width:320,height:568});await p.evaluate(()=>{history.pushState({},'','/jobs');dispatchEvent(new PopStateEvent('popstate'));});await expect(p.locator('.sf-board')).toBeVisible();assert.ok(await p.locator('.cr-site-navbar .auth-logo').evaluate(e=>parseFloat(getComputedStyle(e).fontSize)>=18));assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await p.evaluate(()=>window.scrollTo({top:700,behavior:'instant'}));await p.locator('.cr-site-navbar .auth-logo').click();await expect.poll(()=>p.evaluate(()=>scrollY)).toBe(0);assert.equal(new URL(p.url()).pathname,'/jobs');assert.deepEqual(errors,[]);checks.push({smallPhone:true,logoScrollToTop:true});
 await writeFile('qa-artifacts/shared-navbar-report.json',JSON.stringify({passed:true,checks},null,2));console.log('PASS: shared navbar on 16 routes at desktop/mobile widths, no duplicate headers, small-phone layout and logo behavior');
}finally{await browser.close();}
