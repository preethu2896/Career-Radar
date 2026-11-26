import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{const p=await b.newPage({reducedMotion:'reduce'});await p.route('**/fonts.googleapis.com/**',r=>r.abort());
for(const width of [1440,1024,768,390]){
 await p.setViewportSize({width,height:950});await p.goto('http://localhost:5173/jobs');await expect(p.locator('.sf-board-job').first()).toBeVisible({timeout:45000});
 await expect(p.locator('.sf-board-tools').getByRole('link',{name:'Saved jobs',exact:true})).toHaveCount(0);
 assert.ok((await p.locator('.sf-board-job-footer p > span').allTextContents()).every(text=>!text.split(' · Checked')[0].match(/[,;|/]/)));
 if(width<=900)await p.getByRole('button',{name:'Filters',exact:true}).click();
 const panel=p.locator(width<=900?'.sf-board-filter-dialog':'.sf-board-sidebar');const input=panel.getByRole(width>1024?'searchbox':'combobox',{name:'Search jobs',exact:true});
 if(width>1024){for(const value of ['Paytm','Bangalore','Engineer']){await input.fill(value);await expect(p.getByRole('listbox')).toHaveCount(0);await expect(p.locator('.sf-board-job').first()).toBeVisible();assert.ok(parseInt(await p.locator('.sf-board-results-heading p[role=status]').innerText())>0);}await input.fill('Paytm');assert.ok((await p.locator('.sf-board-job-heading > div > p').allTextContents()).every(text=>/Paytm/i.test(text)));}
 else{await input.fill('Data');await expect(panel.getByRole('option').filter({hasText:'Role'}).first()).toBeVisible();await input.fill('bang');await expect(panel.getByRole('option',{name:'Bengaluru Location',exact:true})).toBeVisible();await panel.getByRole('option',{name:'Bengaluru Location',exact:true}).click();await expect(input).toHaveValue('Bengaluru');if(width<=900)await panel.locator('.sf-sheet-footer > button').click();}
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await p.screenshot({path:`qa-artifacts/responsive-job-search-${width}.png`});console.log(JSON.stringify({width,desktopLiveResults:width>1024,compactSuggestions:width<=1024,savedLinkRemoved:true,singleLocation:true}));
}
}finally{await b.close();}
