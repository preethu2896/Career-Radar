import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {chromium,expect as baseExpect} from '@playwright/test';
const expect=baseExpect.configure({timeout:30000});
const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const errors=[],checks=[];
try{
 const p=await b.newPage({reducedMotion:'reduce'});p.on('pageerror',e=>errors.push(e.message));
 await p.route('https://fonts.googleapis.com/**',r=>r.abort());await p.route('https://fonts.gstatic.com/**',r=>r.abort());
 await p.goto('http://localhost:5173/jobs',{waitUntil:'domcontentloaded'});await expect(p.locator('.sf-board-job').first()).toBeVisible();
 const target=await p.locator('.sf-board-job h3 a').first().getAttribute('href');
 await p.locator('.sf-board-job-footer a').first().click();await p.waitForURL(url=>url.pathname===target);await expect(p.locator('.sf-role-summary h1')).toBeVisible();
 for(const width of [1440,1024,768,500,390,320]){
  await p.setViewportSize({width,height:900});await p.goto('http://localhost:5173'+target,{waitUntil:'domcontentloaded'});await expect(p.locator('.sf-role-summary h1')).toBeVisible();await expect(p.locator('.sf-role-more .sf-board-job')).toHaveCount(6);
  const layout=await p.evaluate(()=>{const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,bottom:r.bottom}};return {summary:rect('.sf-role-summary'),apply:rect('.sf-role-apply'),description:rect('.sf-role-description'),overflow:document.documentElement.scrollWidth>innerWidth+1};});
  assert.equal(layout.overflow,false,'Overflow at '+width);
  if(width<=760){assert.ok(layout.apply.y>=layout.summary.bottom);assert.ok(layout.description.y>=layout.apply.bottom);assert.ok(Math.abs(layout.apply.x-layout.summary.x)<1);}else{assert.ok(layout.apply.x>layout.summary.x+layout.summary.w);assert.ok(Math.abs(layout.apply.y-layout.summary.y)<2);}
  const login=await p.getByRole('link',{name:'Sign in to apply',exact:true}).getAttribute('href');assert.equal(new URL(login,'http://localhost').searchParams.get('redirect'),target);
  const roleLinks=await p.locator('.sf-role-more .sf-board-job h3 a').evaluateAll(es=>es.map(e=>e.getAttribute('href')));assert.ok(roleLinks.every(href=>href!==target));
  const mainCompany=await p.locator('.sf-role-title>div>a').innerText();assert.ok((await p.locator('.sf-role-more .sf-board-job-heading p').allTextContents()).every(s=>s===mainCompany));
  await p.screenshot({path:`qa-artifacts/job-details-${width}.png`,fullPage:false});checks.push({width,layout:true,guestApplyGated:true,sixRealCompanyRoles:true});
 }
 await p.getByRole('link',{name:'Sign in to apply',exact:true}).click();await p.waitForURL(url=>url.pathname==='/login');assert.equal(new URL(p.url()).searchParams.get('redirect'),target);
 await p.goto('http://localhost:5173'+target,{waitUntil:'domcontentloaded'});await expect(p.locator('.sf-role-summary')).toBeVisible();await p.locator('.sf-role-more .sf-board-job h3 a').first().click();await expect(p.locator('.sf-role-summary')).toBeVisible();assert.notEqual(new URL(p.url()).pathname,target);
 assert.deepEqual(errors,[]);await writeFile('qa-artifacts/job-detail-report.json',JSON.stringify({passed:true,target,checks,applyRedirect:true,relatedRoleNavigation:true},null,2));console.log('PASS: job-detail layout at six widths, exact company roles, guest apply redirect and related-role navigation.');
}finally{await b.close();}
