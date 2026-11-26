import assert from 'node:assert/strict';
import{randomUUID,randomBytes,createHash}from'node:crypto';
import{mkdir,readFile,writeFile}from'node:fs/promises';
import{execFileSync}from'node:child_process';
import{createClerkClient}from'@clerk/backend';
import{createClient}from'@supabase/supabase-js';
import{chromium,expect as baseExpect}from'@playwright/test';
const expect=baseExpect.configure({timeout:60000});
import{clerkSetup,setupClerkTestingToken}from'@clerk/testing/playwright';
const origin=process.env.CR_QA_ORIGIN??'http://localhost:5173';
const baseline=JSON.parse(await readFile('.clerk/migrate/baseline.json','utf8'));
assert.equal(new URL(process.env.VITE_SUPABASE_URL).hostname,baseline.project+'.supabase.co');
const clerk=createClerkClient({secretKey:process.env.CLERK_SECRET_KEY,publishableKey:process.env.VITE_CLERK_PUBLISHABLE_KEY});
const runId=randomUUID();const accounts=[0,1].map(index=>({email:`qa-${runId}-${index}+clerk_test@example.com`,password:'Qa!8Aa'+randomBytes(20).toString('hex'),id:null,accountId:null}));
const checks=[];const pass=name=>{checks.push({name,passed:true});console.log('PASS: '+name);};
const unwrap=result=>{if(result.error)throw new Error(result.error.message);return result.data;};
let browser,context,page,failure;const contexts=[];const pageErrors=[];
await mkdir('qa-artifacts',{recursive:true});
const snapshot=async name=>page.screenshot({path:'qa-artifacts/clerk-'+name+'.png',fullPage:true});
function pdf(version){const lines=['QA Candidate','SKILLS','Data Analysis SQL Python React Docker Excel LangGraph Tally Figma Communication','EDUCATION','Bachelor of Engineering in Computer Science and Design CGPA: 8.26 / 10','Example University August 2021 - May 2025',version];const stream='BT /F1 11 Tf 35 740 Td '+lines.map((line,index)=>(index?'0 -22 Td ':'')+'('+line+') Tj').join(' ')+' ET';const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];let body='%PDF-1.4\n';const offsets=[0];objects.forEach((obj,i)=>{offsets.push(Buffer.byteLength(body));body+=`${i+1} 0 obj\n${obj}\nendobj\n`;});const start=Buffer.byteLength(body);body+='xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(v=>String(v).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;return Buffer.from(body);}
async function newPage(){const ctx=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});contexts.push(ctx);await setupClerkTestingToken({context:ctx,options:{frontendApiUrl:new URL(baseline.issuer).hostname}});const p=await ctx.newPage();p.setDefaultTimeout(60000);p.on('pageerror',error=>pageErrors.push(error.message));return{ctx,p};}
async function apiFor(account){const session=await clerk.sessions.createSession({userId:account.id});const client=createClient(process.env.VITE_SUPABASE_URL,process.env.VITE_SUPABASE_ANON_KEY,{accessToken:async()=>(await clerk.sessions.getToken(session.id)).jwt});const id=unwrap(await client.functions.invoke('candidate-identity',{method:'POST'}));account.accountId=id.user_id;return{client,session};}
async function verifyCodeIfNeeded(){await expect.poll(async()=>await page.getByRole('heading',{name:'Check your email',exact:true}).isVisible()||!['/login','/signup'].includes(new URL(page.url()).pathname),{timeout:60000}).toBe(true);if(await page.getByRole('heading',{name:'Check your email',exact:true}).isVisible()){await page.getByLabel('Verification code',{exact:true}).fill('424242');await page.getByRole('button',{name:'Verify and continue',exact:true}).click();}}
async function login(account){await page.goto(origin+'/login');await page.getByLabel('Email address',{exact:true}).fill(account.email);await page.getByLabel('Password',{exact:true}).fill(account.password);await page.getByRole('button',{name:'Log in',exact:true}).click();await verifyCodeIfNeeded();await page.waitForURL(url=>['/onboarding','/dashboard'].includes(url.pathname),{timeout:60000});}
async function headerLogout(){const menu=page.locator('.cr-site-navbar .sf-account-menu');if(await menu.getAttribute('open')===null)await menu.locator('summary').click();await menu.getByRole('button',{name:'Sign out',exact:true}).click();}
async function headerProfile(){const menu=page.locator('.cr-site-navbar .sf-account-menu');if(await menu.getAttribute('open')===null)await menu.locator('summary').click();await menu.getByRole('link',{name:'Your profile',exact:true}).click();}
async function next(){await page.getByRole('button',{name:'Continue',exact:true}).click();}
async function layout(name){const r=await page.evaluate(()=>({w:innerWidth,scroll:document.documentElement.scrollWidth,panels:[...document.querySelectorAll('.cr-setup *')].filter(e=>e.getClientRects().length&&['auto','scroll'].includes(getComputedStyle(e).overflowY)&&e.scrollHeight>e.clientHeight+2).map(e=>e.className)}));assert.ok(r.scroll<=r.w+2,'Horizontal overflow at '+name);assert.deepEqual(r.panels,[],'Nested scrolling at '+name);checks.push({name:'Layout '+name,passed:true});}
async function signup(account,index){
 await page.goto(origin+'/signup');await page.getByLabel('First name',{exact:true}).fill(index?'QASecond':'QAFirst');await page.getByLabel('Last name',{exact:false}).fill('Journey');await page.getByLabel('Email address',{exact:true}).fill(account.email);await page.getByLabel('Password',{exact:true}).fill(account.password);await page.getByLabel('Confirm password',{exact:true}).fill(account.password);await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Create account',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Check your email',exact:true})).toBeVisible();await page.getByLabel('Verification code',{exact:true}).fill('424242');await page.getByRole('button',{name:'Verify and continue',exact:true}).click();await page.waitForURL('**/onboarding');const users=await clerk.users.getUserList({emailAddress:[account.email]});assert.equal(users.data.length,1);account.id=users.data[0].id;await clerk.users.updateUserMetadata(account.id,{privateMetadata:{qa_run:runId}});
}

const accountApis=new Map();
try {
 await clerkSetup({publishableKey:process.env.VITE_CLERK_PUBLISHABLE_KEY,secretKey:process.env.CLERK_SECRET_KEY,dotenv:false});
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 ({ctx:context,p:page}=await newPage());
 await page.goto(origin+'/account');await page.waitForURL(u=>u.pathname==='/login');
 assert.equal(new URL(page.url()).searchParams.get('redirect'),'/account');pass('Account access requires login and preserves return path');
 await signup(accounts[0],0);
 await expect(page.getByRole('heading',{name:'Make it yours.',exact:true})).toBeVisible();
 assert.equal(await page.locator('input[type=file]').count(),0);
 assert.equal(await page.getByLabel('Graduation year',{exact:true}).count(),0);
 for(const width of [1440,768,390,320]) {await page.setViewportSize({width,height:844});await layout('welcome-'+width);await page.screenshot({path:'qa-artifacts/profile-welcome-'+width+'.png',fullPage:true});}
 await page.getByRole('button',{name:'Skip for now',exact:true}).click();await page.waitForURL('**/jobs');
 const api=await apiFor(accounts[0]);accountApis.set(accounts[0],api);
 let profile=unwrap(await api.client.from('profiles').select('*').eq('id',accounts[0].accountId).single());
 assert.equal(profile.onboarding_complete,true);assert.equal(profile.education_degree,null);assert.deepEqual(profile.target_roles,[]);
 assert.equal(unwrap(await api.client.from('candidate_resumes').select('*')).length,0);pass('Real signup and skip work without resume, role, marks or education');
 await page.goto(origin+'/profile');await expect(page.getByRole('heading',{name:'Your profile.',exact:true})).toBeVisible();
 await page.getByLabel('First name (optional)',{exact:true}).fill('Profile Test');
 await page.getByRole('combobox',{name:'Search or add a role',exact:true}).fill('Data Analyst');
 await page.getByRole('option',{name:'Data Analyst',exact:true}).click();
 await page.getByRole('combobox',{name:'Search or add a location',exact:true}).fill('Bengaluru');
 await page.getByRole('option',{name:'Bengaluru',exact:true}).click();
 await page.getByRole('checkbox',{name:'Hybrid',exact:true}).check();
 await page.getByRole('button',{name:'Save profile',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Profile saved.'})).toBeVisible();
 await page.reload();await expect(page.getByLabel('First name (optional)',{exact:true})).toHaveValue('Profile Test');
 await expect(page.getByRole('button',{name:'Remove role Data Analyst',exact:true})).toBeVisible();pass('Profile preferences and name persist after refresh');
 await page.route('**/rest/v1/profiles*',route=>route.request().method()==='POST'?route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({message:'Test connection interrupted. Retry saving.'})}):route.continue());
 await page.getByLabel('Last name (optional)',{exact:true}).fill('Retry');await page.getByRole('button',{name:'Save profile',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Retry saving');await expect(page.getByRole('button',{name:'Save profile',exact:true})).toBeEnabled();
 await page.unroute('**/rest/v1/profiles*');await page.getByRole('button',{name:'Save profile',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Profile saved.'})).toBeVisible();pass('Profile save failure keeps edits and supports retry');
 accounts[0].pdf=pdf('Profile optional resume QA');
 await page.locator('input[type=file]').setInputFiles({name:'qa-profile.pdf',mimeType:'application/pdf',buffer:accounts[0].pdf});
 await expect(page.getByText('Résumé saved privately.',{exact:true})).toBeVisible();
 const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Download',exact:true}).click()]);
 assert.equal(createHash('sha256').update(await readFile(await download.path())).digest('hex'),createHash('sha256').update(accounts[0].pdf).digest('hex'));pass('Optional private resume upload and download work');
 for(const width of [1440,768,390,320]) {await page.setViewportSize({width,height:844});await layout('profile-'+width);await page.screenshot({path:'qa-artifacts/profile-settings-'+width+'.png',fullPage:true});}
 await page.goto(origin+'/account');await expect(page.getByRole('heading',{name:'Your account.',exact:true})).toBeVisible();await expect(page.getByText('Coming soon.',{exact:true})).toBeVisible();await page.getByRole('link',{name:'Edit your profile',exact:false}).click();await expect(page.getByRole('heading',{name:'Your profile.',exact:true})).toBeVisible();pass('Account and profile have dedicated pages, not onboarding');
 await headerLogout();
 const created=await clerk.users.createUser({emailAddress:[accounts[1].email],password:accounts[1].password,firstName:'Second',lastName:'QA',skipPasswordChecks:true,skipLegalChecks:true,privateMetadata:{qa_run:runId}});accounts[1].id=created.id;
 const api2=await apiFor(accounts[1]);accountApis.set(accounts[1],api2);
 const original=unwrap(await api2.client.from('profiles').select('*').eq('id',accounts[1].accountId).single());
 unwrap(await api2.client.from('profiles').upsert({...original,education_degree:'B.Com',graduation_year:2025,education_score:'81',skills:['SQL'],career_stage:'Student / Fresher',onboarding_complete:false}));
 await login(accounts[1]);await expect(page.getByRole('heading',{name:'Make it yours.',exact:true})).toBeVisible();
 await page.getByRole('combobox',{name:'Search or add a role',exact:true}).fill('Software Engineer');await page.getByRole('option',{name:'Software Engineer',exact:true}).click();
 await page.getByRole('button',{name:'Explore jobs',exact:true}).click();await page.waitForURL('**/jobs');
 await page.goto(origin+'/profile');await expect(page.getByLabel('First name (optional)',{exact:true})).toHaveValue('Second');
 assert.equal(await page.getByRole('button',{name:'Remove role Data Analyst',exact:true}).count(),0);assert.equal(await page.getByText('qa-profile.pdf',{exact:true}).count(),0);
 await page.getByRole('button',{name:'Save profile',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Profile saved.'})).toBeVisible();
 profile=unwrap(await api2.client.from('profiles').select('*').eq('id',accounts[1].accountId).single());
 assert.equal(profile.education_degree,'B.Com');assert.equal(profile.education_score,'81');assert.equal(profile.graduation_year,2025);assert.deepEqual(profile.skills,['SQL']);
 const other=await api2.client.from('profiles').select('*').eq('id',accounts[0].accountId);assert.deepEqual(unwrap(other),[]);pass('Two accounts stay isolated and older profile details survive shorter onboarding and saving');
 await page.goto(origin+'/dashboard');await expect(page.locator('.sf-board-intro h1')).toBeVisible();pass('Dashboard remains reachable after optional onboarding');
 assert.deepEqual(pageErrors,[]);pass('No browser runtime errors');
} catch(error) {failure=error;console.error('PROFILE QA FAILED: '+error.message);if(page)await snapshot('profile-failure').catch(()=>{});}
finally{
 for(const ctx of contexts)await ctx.close().catch(()=>{});await browser?.close().catch(()=>{});
 let cleaned=true;const removable=[];
 for(const account of accounts){try{if(!account.id){const users=await clerk.users.getUserList({emailAddress:[account.email]});account.id=users.data[0]?.id??null;}if(!account.id)continue;assert.ok(!baseline.mappings.some(link=>link.subject===account.id));const user=await clerk.users.getUser(account.id);assert.ok(user.emailAddresses.some(email=>email.emailAddress===account.email));const {client,session}=await apiFor(account);const deletion=await client.functions.invoke('manage-resume',{method:'DELETE'});if(deletion.error)throw deletion.error;assert.equal(unwrap(await client.storage.from('candidate-resumes').list(account.accountId)).length,0);removable.push({subject:account.id,id:account.accountId});await clerk.sessions.revokeSession(session.id).catch(()=>{});await clerk.users.deleteUser(account.id);}catch{cleaned=false;console.error('QA cleanup needs retry for a disposable account.');}}
 if(removable.length){try{const quote=value=>"'"+value.replaceAll("'","''")+"'";const sql='delete from public.candidate_accounts where id in ('+removable.map(row=>quote(row.id)).join(',')+') and id not in ('+baseline.accountIds.map(quote).join(',')+') and exists(select 1 from public.candidate_identity_links l where l.account_id=candidate_accounts.id and l.subject in ('+removable.map(row=>quote(row.subject)).join(',')+'));';await writeFile('qa-artifacts/clerk-cleanup.sql',sql);execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',`npx supabase db query --remote=${baseline.project} --file qa-artifacts/clerk-cleanup.sql --yes`],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:60000});}catch{cleaned=false;}}
 if(cleaned)pass('Disposable Clerk accounts, QA PDFs and database records cleaned up');await writeFile('qa-artifacts/profile-onboarding-report.json',JSON.stringify({passed:!failure,cleanupComplete:cleaned,checks,runId,origin},null,2));if(failure||!cleaned)process.exitCode=1;
}
