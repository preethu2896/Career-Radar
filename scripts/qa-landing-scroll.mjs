import assert from 'node:assert/strict';
import {chromium,expect as baseExpect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const expect=baseExpect.configure({timeout:20000});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const checks=[];
try{
 for(const width of [1440,768,390,320]){
  const ctx=await browser.newContext({viewport:{width,height:850},reducedMotion:width===320?'reduce':'no-preference'});await ctx.route('https://fonts.googleapis.com/**',r=>r.abort());await ctx.route('https://fonts.gstatic.com/**',r=>r.abort());const p=await ctx.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('http://localhost:5173/',{waitUntil:'domcontentloaded'});const nav=p.locator('.landing-nav');await expect(nav).toBeVisible();
  const scroll=async top=>{await p.evaluate(top=>window.scrollTo({top,behavior:'instant'}),top);};
  await scroll(650);await expect(nav).toHaveAttribute('aria-hidden','true');await expect(nav).not.toBeVisible();await scroll(580);await expect(nav).toHaveAttribute('aria-hidden','false');await expect(nav).toBeVisible();await expect.poll(()=>nav.evaluate(e=>e.getBoundingClientRect().top)).toBeGreaterThanOrEqual(0);assert.ok(await p.evaluate(()=>scrollY)>300,'Up-scroll unexpectedly returned to page top');
  await scroll(581);await expect(nav).toHaveAttribute('aria-hidden','false');await scroll(900);await expect(nav).toHaveAttribute('aria-hidden','true');await scroll(0);await expect(nav).toHaveAttribute('aria-hidden','false');
  if(width<=680){await scroll(600);await expect(nav).toHaveAttribute('aria-hidden','true');await scroll(500);await expect(nav).toHaveAttribute('aria-hidden','false');await nav.getByRole('button',{name:'Open navigation',exact:true}).click();await expect(nav.locator('.mobile-nav-panel')).toBeVisible();await scroll(750);await expect(nav).toHaveAttribute('aria-hidden','false');await expect(nav.locator('.mobile-nav-panel')).toBeVisible();await p.keyboard.press('Escape');await expect(nav.locator('.mobile-nav-panel')).toHaveCount(0);await scroll(850);await expect(nav).toHaveAttribute('aria-hidden','false');await p.evaluate(()=>{if(document.activeElement instanceof HTMLElement)document.activeElement.blur();});await scroll(950);await expect(nav).toHaveAttribute('aria-hidden','true');checks.push({width,mobileMenuRemainsUsable:true});}
  await scroll(0);await expect(nav).toHaveAttribute('aria-hidden','false');await p.screenshot({path:`qa-artifacts/landing-scroll-${width}.png`,fullPage:false});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await p.goto('http://localhost:5173/jobs',{waitUntil:'domcontentloaded'});await expect(p.locator('.cr-site-navbar')).toBeVisible();await expect(p.locator('.landing-nav')).toHaveCount(0);await scroll(500);await expect(p.locator('.cr-site-navbar')).toBeVisible();assert.deepEqual(errors,[]);checks.push({width,hideDown:true,revealUp:true,topVisible:true,jitterIgnored:true,jobsUnchanged:true});await ctx.close();
 }
 await writeFile('qa-artifacts/landing-scroll-report.json',JSON.stringify({passed:true,checks},null,2));console.log('PASS: scroll down hides, scroll up reveals, top remains visible, mobile menu works, and Jobs navbar is unchanged at four widths');
}finally{await browser.close();}
