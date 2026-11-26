import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll,beforeAll,beforeEach,expect,it } from 'vitest';
const db=new PGlite();const alice='00000000-0000-4000-8000-000000000001',bob='00000000-0000-4000-8000-000000000002';
beforeAll(async()=>{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;insert into auth.users values('${alice}'),('${bob}');`);
  for(const file of ['202610100002_candidate_profiles.sql','202610220005_candidate_profile_extensions.sql','202611200010_candidate_workspace.sql'])await db.exec(readFileSync(`supabase/migrations/${file}`,'utf8'));
  await db.exec('grant select,insert,update on public.profiles to authenticated;');
},30000);
beforeEach(async()=>{await db.exec('reset role;delete from public.candidate_applications;delete from public.career_opportunities;delete from public.profiles;');});
afterAll(async()=>{await db.close();});
it('keeps application stages, notes and deletion private to the owner',async()=>{
  await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${alice}',false);`);
  await db.query("insert into public.candidate_applications(user_id,entity_key,source_kind,company_name,title,notes) values($1,'manual:one','MANUAL','Example','Analyst','Private notes')",[alice]);
  await db.exec(`select set_config('request.jwt.claim.sub','${bob}',false);`);
  expect((await db.query('select * from public.candidate_applications')).rows).toHaveLength(0);
  expect((await db.query("update public.candidate_applications set status='Applied' returning *")).rows).toHaveLength(0);
  expect((await db.query('delete from public.candidate_applications returning *')).rows).toHaveLength(0);
  await expect(db.query("insert into public.candidate_applications(user_id,entity_key,source_kind,company_name,title) values($1,'spoof','MANUAL','Example','Analyst')",[alice])).rejects.toThrow();
});
it('allows public published openings and blocks both drafts and client publishing',async()=>{
  await db.exec("insert into public.career_opportunities(company_name,title,source_url,publication_state) values('Example','Published','https://example.com','PUBLISHED'),('Example','Draft','https://example.com','DRAFT');set role anon;");
  expect((await db.query('select title from public.career_opportunities')).rows).toEqual([{title:'Published'}]);
  await expect(db.query("insert into public.career_opportunities(company_name,title,source_url)values('Fake','Role','https://example.com')")).rejects.toThrow();
});
it('preserves the applied date when notes change and rejects unsupported stages',async()=>{
  await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${alice}',false);`);
  await db.query("insert into public.candidate_applications(user_id,entity_key,source_kind,company_name,title,status,applied_at) values($1,'manual:one','MANUAL','Example','Analyst','Applied','2026-10-01T00:00:00Z')",[alice]);
  await db.query("update public.candidate_applications set notes='Followed up'");
  const result=await db.query<{applied_at:Date}>('select applied_at from public.candidate_applications');
  expect(new Date(result.rows[0]!.applied_at).toISOString()).toBe('2026-10-01T00:00:00.000Z');
  await expect(db.query("update public.candidate_applications set status='Automatically applied'")).rejects.toThrow();
});
it('accepts optional education fields without requiring technical profile links',async()=>{
  await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${alice}',false);`);
  await db.query("insert into public.profiles(id,first_name,education_degree,graduation_year,education_score,onboarding_complete) values($1,'Asha','B.Com',2026,'75%',true)",[alice]);
  expect((await db.query('select education_degree from public.profiles')).rows).toEqual([{education_degree:'B.Com'}]);
  await expect(db.query("update public.profiles set graduation_year=10")).rejects.toThrow();
});
