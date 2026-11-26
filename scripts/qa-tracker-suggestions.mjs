import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium,expect as baseExpect} from '@playwright/test';
const expect=baseExpect.configure({timeout:15000});const selectedCompany=JSON.parse(await readFile('public/data/company-search.json','utf8'))[0];
const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{const page=await b.newPage();let writes=0;await page.route('**/*.supabase.co/**',route=>{if(!['GET','HEAD','OPTIONS'].includes(route.request().method()))writes++;return route.abort();});
 await page.goto('http://localhost:5173/jobs');await expect(page.locator('.sf-board')).toBeVisible();
 await page.evaluate(async()=>{const React=(await import('/node_modules/.vite/deps/react.js')).default;const dom=await import('/node_modules/.vite/deps/react-dom_client.js');const createRoot=dom.createRoot??dom.default.createRoot;const {Tracker}=await import('/src/ui/CandidateWorkspace.tsx');const el=document.createElement('div');el.id='tracker-qa';document.body.appendChild(el);createRoot(el).render(React.createElement(Tracker,{userId:'isolated-ui-check',rows:[],setRows:()=>{},error:'',retry:()=>{}}));});
 const root=page.locator('#tracker-qa');await root.getByRole('button',{name:'+ Add a role'}).click();
 const company=root.getByRole('combobox',{name:'Company',exact:true});await company.fill(selectedCompany);await expect(root.getByRole('option',{name:selectedCompany+' Company',exact:true})).toBeVisible();await company.press('ArrowDown');await company.press('Enter');await expect(company).toHaveValue(selectedCompany);await expect(company).toHaveAttribute('maxlength','160');await expect(company).toHaveAttribute('required','');
 const role=root.getByRole('combobox',{name:'Role',exact:true});await role.fill('Software');await expect(root.getByRole('option',{name:/Software Engineer/}).first()).toBeVisible();await role.press('ArrowDown');await role.press('Enter');assert.ok((await role.inputValue()).includes('Software'));await expect(role).toHaveAttribute('maxlength','200');assert.equal(writes,0);console.log('PASS: isolated tracker company and role suggestions, keyboard selection and existing field limits; no backend writes.');
}finally{await b.close();}
