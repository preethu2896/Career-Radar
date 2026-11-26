import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
const baseline=process.argv.includes('--baseline');
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const p=await browser.newPage({reducedMotion:'reduce'});await p.route('https://fonts.googleapis.com/**',r=>r.abort());await p.route('https://fonts.gstatic.com/**',r=>r.abort());
 const checks=[];const original=baseline?[]:JSON.parse(await readFile('qa-artifacts/navbar-brand-baseline.json','utf8'));
 for(const width of [1440,768,390,320])for(const path of ['/','/jobs']){
  await p.setViewportSize({width,height:900});await p.goto('http://localhost:5173'+path,{waitUntil:'domcontentloaded'});
  const header=p.locator(path==='/'?'.landing-nav':'.cr-site-navbar');await header.waitFor();
  const measure=await header.evaluate(e=>({height:e.getBoundingClientRect().height,font:getComputedStyle(e.querySelector(location.pathname==='/'?'.brand':'.auth-logo')).fontSize,overflow:document.documentElement.scrollWidth>innerWidth+1}));
  if(!baseline){
   const before=original.find(c=>c.width===width&&c.path===path);assert.equal(measure.height,before.height,'Navbar height changed '+path+' '+width);assert.equal(measure.font,before.font,'Text size changed');assert.equal(measure.overflow,false);
   const mark=header.locator('img.cr-navbar-mark');await mark.evaluate(i=>i.decode());assert.equal(await mark.getAttribute('src'),'/careerradar-logo.png');
   const icon=await p.locator('link[rel="icon"]').getAttribute('href');assert.equal(icon,'/careerradar-logo.png');const response=await p.request.get('http://localhost:5173'+icon);assert.ok(response.ok());assert.ok(response.headers()['content-type'].includes('image/png'));
   await p.screenshot({path:`qa-artifacts/navbar-brand-${path==='/'?'landing':'jobs'}-${width}.png`,fullPage:false});
  }
  checks.push({width,path,...measure});
 }
 await writeFile('qa-artifacts/'+(baseline?'navbar-brand-baseline.json':'navbar-brand-report.json'),JSON.stringify(checks,null,2));console.log(baseline?'Baseline recorded.':'PASS: chosen logo and PNG favicon loaded; navbar heights, text sizes and responsive layout preserved.');
}finally{await browser.close();}
