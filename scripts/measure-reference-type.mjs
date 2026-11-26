import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const reports=[];
try{
 const page=await browser.newPage();
 for(const width of [1440,390]){await page.setViewportSize({width,height:900});for(const path of ['/','/pricing']){
  await page.goto('https://www.remjobs.works'+path,{waitUntil:'domcontentloaded',timeout:45000});await page.locator('h1').first().waitFor({timeout:20000});
  const samples=await page.evaluate(()=>[...document.querySelectorAll('header a,nav a,h1,h2,h3,label,input,select,button,p,small')].filter(e=>e.getClientRects().length>0).slice(0,120).map(e=>{const s=getComputedStyle(e);return{tag:e.tagName,text:(e.textContent||e.getAttribute('placeholder')||e.getAttribute('aria-label')||'').trim().replace(/\s+/g,' ').slice(0,60),size:s.fontSize,line:s.lineHeight,weight:s.fontWeight,css:typeof e.className==='string'?e.className:''};}));
  reports.push({width,path,samples});
 }}
 await writeFile('qa-artifacts/reference-typography.json',JSON.stringify(reports,null,2));
 console.log(JSON.stringify(reports.map(r=>({width:r.width,path:r.path,samples:r.samples.filter(s=>['H1','H2','H3','INPUT','SELECT','LABEL','SMALL'].includes(s.tag)).slice(0,23)})),null,2));
}finally{await browser.close();}
