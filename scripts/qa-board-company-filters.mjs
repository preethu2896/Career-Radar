import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {chromium,expect as baseExpect} from '@playwright/test';
const expect=baseExpect.configure({timeout:30000});
const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const checks=[];
try{const p=await b.newPage({reducedMotion:'reduce'});await p.route('https://fonts.googleapis.com/**',r=>r.abort());await p.route('https://fonts.gstatic.com/**',r=>r.abort());
 for(const width of [1440,768,390,320]){
  await p.setViewportSize({width,height:900});await p.goto('http://localhost:5173/jobs',{waitUntil:'domcontentloaded'});await expect(p.locator('.sf-board-job').first()).toBeVisible();
  if(width<=900)await p.getByRole('button',{name:'Filters',exact:true}).click();
  const panel=p.locator(width<=900?'.sf-board-filter-dialog':'.sf-board-sidebar');const browse=panel.getByRole('navigation',{name:'Browse jobs and companies'});
  await expect(browse.getByRole('link',{name:/All companies/})).toContainText('9,568');
  await panel.locator('summary').filter({hasText:/^Company/}).click();const select=panel.getByLabel('Company',{exact:true});const options=await select.locator('option').evaluateAll(els=>els.slice(1).map(el=>({value:el.value,label:el.textContent})));
  assert.ok(options.length>3,'All connected hiring companies are selectable');const company=options.find(r=>/\([2-9]\d*\)$/.test(r.label))??options[0];const expected=Number(company.label.match(/\((\d+)\)$/)[1]);await select.selectOption(company.value);
  await expect(p.locator('.sf-board-results-heading p[role=status]')).toContainText(`${expected} ${expected===1?'role':'roles'} in this selection`);
  await expect(panel.locator('.sf-date-grid button').first().locator('small')).toHaveText(String(expected));assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await p.screenshot({path:`qa-artifacts/board-company-filter-${width}.png`});
  await browse.getByRole('button',{name:/All jobs/}).click();await expect(select).toHaveValue('');
  await panel.getByLabel('Search jobs',{exact:true}).fill('1millionresume');await expect(browse.getByRole('link',{name:/All companies/})).toHaveAttribute('href','/companies?q=1millionresume');await browse.getByRole('link',{name:/All companies/}).click();await expect(p.locator('.sf-company-list h2 a')).toHaveText(['1millionresume']);
  checks.push({width,fullDirectoryCount:9568,companyOptions:options.length,selectedCompany:company.value,selectedJobCount:expected,countsAgree:true,resetWorks:true,importedCompanySearchWorks:true});
 }
 await writeFile('qa-artifacts/board-company-filters.json',JSON.stringify({passed:true,checks},null,2));console.log('PASS: all-company directory link, live-company filtering, contextual counts, reset and imported company search on desktop/tablet/mobile.');
}finally{await b.close();}
