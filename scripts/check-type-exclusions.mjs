import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
const browser = await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
 const page = await browser.newPage();
 await page.route('https://fonts.googleapis.com/**', r => r.abort());
 await page.route('https://fonts.gstatic.com/**', r => r.abort());
 for (const width of [1440,390,320]) {
  await page.setViewportSize({width,height:900});
  for (const path of ['/','/login','/signup','/forgot-password','/reset-password','/onboarding','/profile']) {
   await page.goto('http://localhost:5173'+path,{waitUntil:'networkidle'});
   assert.equal(await page.locator('.cr-product-type').count(),0,path+' must keep original typography');
   const before=await page.locator('h1,h2,input,label,button').evaluateAll(els=>els.map(e=>getComputedStyle(e).fontSize));
   await page.evaluate(()=>{for(const s of document.styleSheets)if(s.href?.includes('productTypography.css'))s.disabled=true;for(const s of document.querySelectorAll('style[data-vite-dev-id]'))if(s.dataset.viteDevId.includes('productTypography.css'))s.sheet.disabled=true;});
   const after=await page.locator('h1,h2,input,label,button').evaluateAll(els=>els.map(e=>getComputedStyle(e).fontSize));
   assert.deepEqual(before,after,'New typography must have no effect on '+path);
  }
  for (const path of ['/jobs','/companies','/pricing','/account','/applications','/about','/privacy','/terms']) {
   await page.goto('http://localhost:5173'+path,{waitUntil:'networkidle'});
   assert.equal(await page.locator('.cr-product-type').count(),1,path+' retains product typography');
   if(path==='/jobs')assert.equal(await page.locator('.sf-board-intro h1').evaluate(e=>getComputedStyle(e).fontSize),width<640?'30px':'40px');
  }
 }
 console.log('PASS: original auth/onboarding/landing sizes preserved; product pages retain reference sizing at desktop and mobile widths.');
} finally { await browser.close(); }
