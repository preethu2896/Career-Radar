import assert from 'node:assert/strict';
import {chromium,expect as baseExpect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const expect=baseExpect.configure({timeout:30000});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const checks=[],errors=[];
try{
 const ctx=await browser.newContext({reducedMotion:'reduce'});await ctx.route('https://fonts.googleapis.com/**',r=>r.abort());await ctx.route('https://fonts.gstatic.com/**',r=>r.abort());const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://localhost:5173/',{waitUntil:'domcontentloaded'});await expect(p.locator('.landing-nav')).toBeVisible();
 const go=async (path,settle=true)=>{await p.evaluate(path=>{history.pushState({},'',path);dispatchEvent(new PopStateEvent('popstate'));},path);if(settle)await expect.poll(()=>p.evaluate(()=>location.pathname)).toBe(path);};
 for(const width of [1440,390,320]){await p.setViewportSize({width,height:width===320?568:900});await go('/');await expect(p.locator('.landing-nav')).toBeVisible();await expect(p.locator('.cr-site-navbar')).toHaveCount(0);await p.screenshot({path:`qa-artifacts/navbar-restored-home-${width}.png`,fullPage:false});
  for(const path of ['/signup','/login','/forgot-password','/reset-password']){await go(path);await expect(p.locator('.auth-page')).toBeVisible();await expect(p.locator('.cr-site-navbar')).toHaveCount(0);await expect(p.locator('.landing-nav')).toHaveCount(0);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));if(path==='/signup'){assert.ok(await p.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+2),'Signup vertical overflow '+width);await p.screenshot({path:`qa-artifacts/navbar-free-signup-${width}.png`,fullPage:false});}checks.push({path,width,noNavbar:true});}
  await go('/jobs');await expect(p.locator('.cr-site-navbar')).toBeVisible();await expect(p.locator('.landing-nav')).toHaveCount(0);await go('/pricing');await expect(p.locator('.cr-site-navbar')).toBeVisible();await go('/about');await expect(p.locator('.cr-site-navbar')).toBeVisible();await expect(p.locator('.landing-nav')).toHaveCount(0);checks.push({width,originalHomepage:true,sharedNavbarElsewhere:true});
 }
 await go('/onboarding',false);await p.waitForURL(url=>url.pathname==='/login');await expect(p.locator('.cr-site-navbar')).toHaveCount(0);await go('/profile',false);await p.waitForURL(url=>url.pathname==='/login');await expect(p.locator('.cr-site-navbar')).toHaveCount(0);assert.deepEqual(errors,[]);checks.push({protectedSetupNoNavbar:true});await writeFile('qa-artifacts/navbar-exceptions-report.json',JSON.stringify({passed:true,checks},null,2));console.log('PASS: homepage navbar restored; auth/setup have no shared navbar; Jobs/Pricing/About keep shared navbar on desktop and phones');
}finally{await browser.close();}
