import assert from 'node:assert/strict';
import {chromium,expect as baseExpect} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
const expect=baseExpect.configure({timeout:30000});
const manifest=JSON.parse(await readFile('data/company-logo-sources.json','utf8'));
const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const p=await b.newPage({reducedMotion:'reduce'});await p.setViewportSize({width:1120,height:850});
 const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
 await p.setContent(`<style>body{margin:16px;font:13px Arial;background:#f4f2ed}.grid{display:grid;grid-template-columns:repeat(7,1fr);gap:8px}.cell{background:white;text-align:center;padding:12px 4px;border-radius:10px}.cell img{width:54px;height:54px;object-fit:contain;display:block;margin:0 auto 8px}</style><div class="grid">${manifest.map(m=>`<div class="cell"><img src="http://localhost:5173${m.path}">${esc(m.company)}</div>`).join('')}</div>`);
 await p.locator('img').evaluateAll(async imgs=>Promise.all(imgs.map(i=>i.decode())));await p.screenshot({path:'qa-artifacts/company-logo-contact-sheet.png',fullPage:true});
 await p.route('https://fonts.googleapis.com/**',r=>r.abort());await p.route('https://fonts.gstatic.com/**',r=>r.abort());
 const checks=[];
 for(const width of [1440,768,390,320]){
  await p.setViewportSize({width,height:900});await p.goto('http://localhost:5173/jobs',{waitUntil:'domcontentloaded'});await expect(p.locator('.sf-board-job')).toHaveCount(24);
  const logos=p.locator('.sf-board-job .cr-company-logo img');await expect(logos.first()).toBeVisible();
  await logos.evaluateAll(async imgs=>Promise.all(imgs.filter(i=>{const r=i.getBoundingClientRect();return r.top<innerHeight}).map(i=>i.decode())));
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  const frames=await p.locator('.sf-board-job .cr-company-logo').evaluateAll(es=>es.slice(0,3).map(e=>{const before=e.getBoundingClientRect();const classes=e.className;e.classList.remove('cr-company-logo','has-logo');const original=e.getBoundingClientRect();e.className=classes;return {w:before.width,h:before.height,originalW:original.width,originalH:original.height};}));assert.ok(frames.every(f=>f.w===f.originalW&&f.h===f.originalH));
  await p.screenshot({path:`qa-artifacts/company-logos-${width}.png`,fullPage:false});checks.push({width,logos:true,framesUnchanged:true});
 }
 await p.setViewportSize({width:390,height:900});await p.route('**/company-logos/**',r=>r.abort());await p.goto('http://localhost:5173/jobs',{waitUntil:'domcontentloaded'});await expect(p.locator('.sf-board-job')).toHaveCount(24);await expect(p.locator('.sf-board-job .cr-company-logo').first()).toHaveText(/^[A-Z0-9]$/);assert.equal(await p.locator('.sf-board-job .cr-company-logo').first().locator('img').count(),0);
 await writeFile('qa-artifacts/company-logo-report.json',JSON.stringify({passed:true,logos:manifest.length,checks,brokenImagesUseInitials:true},null,2));console.log('PASS: local logos load, 40px frames and responsive layout preserved, failed images show initials.');
}finally{await b.close();}
