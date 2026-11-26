import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
  const page=await browser.newPage({reducedMotion:'reduce'});
  await page.route('**/fonts.googleapis.com/**',route=>route.abort());
  for(const width of [1440,390,320]){
    await page.setViewportSize({width,height:960});
    await page.goto('http://localhost:5173/jobs',{waitUntil:'domcontentloaded'});
    await expect(page.locator('.sf-board-job').first()).toBeVisible({timeout:45000});
    const facts=await page.locator('.sf-board-tags span').allTextContents();
    assert.ok(facts.every(text=>text.length<=40&&!/[•\n]/.test(text)));
    assert.ok(facts.every(text=>!text.includes('scientists and IIT Bombay')));
    assert.ok(!await page.locator('.sf-board-tags').filter({hasText:'Experience not stated'}).count());
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.screenshot({path:`qa-artifacts/job-card-tags-${width}.png`});
    console.log(JSON.stringify({width,cards:await page.locator('.sf-board-job').count(),tags:facts.slice(0,12),noOverflow:true}));
  }
} finally {await browser.close();}
