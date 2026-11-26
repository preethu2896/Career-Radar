import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const p=await browser.newPage();
 await p.route('https://fonts.googleapis.com/**',r=>r.abort());await p.route('https://fonts.gstatic.com/**',r=>r.abort());
 for(const width of [1440,768,390,320]){
  await p.setViewportSize({width,height:900});
  for(const path of ['/jobs','/companies','/pricing','/account','/applications','/about','/terms']){
   await p.goto('http://localhost:5173'+path,{waitUntil:'domcontentloaded'});
   await p.locator('.cr-site-navbar').waitFor();
   const result=await p.locator('.cr-site-navbar').evaluate(e=>({height:e.getBoundingClientRect().height,logo:getComputedStyle(e.querySelector('.auth-logo')).fontSize,pricing:getComputedStyle(e.querySelector('a[href="/pricing"]')).fontSize,fit:document.documentElement.scrollWidth<=innerWidth+1}));
   assert.equal(result.logo,'20px');assert.equal(result.pricing,'14px');assert.equal(result.height,width<=680?60:66);assert.ok(result.fit,path+' overflow '+width);
  }
  await p.goto('http://localhost:5173/',{waitUntil:'domcontentloaded'});assert.equal(await p.locator('.cr-site-navbar').count(),0);await p.locator('.landing-nav').waitFor();
 }
 console.log('PASS: larger navbar text, unchanged 66px/60px header height, no overflow at four widths, landing navbar unchanged.');
}finally{await browser.close();}
