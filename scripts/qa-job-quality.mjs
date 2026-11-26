import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
import {writeFile,mkdir} from 'node:fs/promises';
const origin=process.env.CR_QA_ORIGIN??'http://localhost:5173';const checks=[];
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{for(const width of [1440,768,390,320]){
 const ctx=await browser.newContext({viewport:{width,height:900},isMobile:width<768,hasTouch:width<768,reducedMotion:'reduce'});const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/jobs?experience=freshers');await expect(page.locator('.sf-board-job').first()).toBeVisible({timeout:60000});
 const cards=await page.locator('.sf-board-job').allTextContents();assert.ok(cards.every(t=>!t.includes('Regional Sales Head')),'No senior training-fresher false matches');assert.ok(cards.length>0);
 if(width<=900){await page.getByRole('button',{name:/^Filters/}).click();await expect(page.locator('dialog[open]')).toBeVisible();await page.getByRole('button',{name:'Close filters',exact:true}).click();}
 await page.goto(origin+'/jobs?query=Weekday%20AI');await expect(page.locator('.sf-board-job').first()).toBeVisible({timeout:60000});const link=page.locator('.sf-board-job h3 a').first();const path=await link.getAttribute('href');assert.ok(path?.startsWith('/jobs/'));await link.click();await expect(page.locator('.sf-role-description')).toBeVisible();const text=await page.locator('.sf-role-description').innerText();assert.ok(text.length>150&&!text.includes('Role-specific details were not provided'));
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:`qa-artifacts/job-quality-${width}.png`,fullPage:false});
 const apply=page.locator('.sf-role-apply .auth-primary');if(await apply.count()){await apply.click();await expect(page).toHaveURL(/\/login/);}
 assert.deepEqual(errors,[]);checks.push({width,fresherResults:true,filters:true,realWorkableDescription:true,noOverflow:true,noRuntimeErrors:true});console.log('PASS: Job quality, real descriptions and layouts at '+width);await ctx.close();
}}finally{await browser.close();await mkdir('qa-artifacts',{recursive:true});await writeFile('qa-artifacts/job-quality-ui-report.json',JSON.stringify(checks,null,2));}
