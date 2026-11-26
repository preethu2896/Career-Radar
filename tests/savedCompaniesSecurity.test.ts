import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, it, expect } from 'vitest';
const db=new PGlite();
const alice='00000000-0000-4000-8000-000000000001',bob='00000000-0000-4000-8000-000000000002';
beforeAll(async()=>{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create table candidate_accounts(id uuid primary key);insert into candidate_accounts values('${alice}'),('${bob}');create function current_candidate_id()returns uuid language sql stable as $$select nullif(current_setting('test.candidate',true),'')::uuid$$;grant usage on schema public to anon,authenticated;`);
 await db.exec(readFileSync('supabase/migrations/202611200013_saved_companies.sql','utf8'));
 await db.exec(`select set_config('test.candidate','${alice}',false);set role authenticated;insert into candidate_saved_companies(user_id,company_id)values('${alice}','company-a');`);
},30000);
afterAll(()=>db.close());
it('rejects saving a company under another account',async()=>{
 await expect(db.exec(`insert into candidate_saved_companies(user_id,company_id)values('${bob}','company-b')`)).rejects.toThrow();
});
it('hides another account’s company saves and prevents deleting them',async()=>{
 await db.exec(`select set_config('test.candidate','${bob}',false)`);
 expect((await db.query('select * from candidate_saved_companies')).rows).toEqual([]);
 await db.exec('delete from candidate_saved_companies');
 await db.exec(`select set_config('test.candidate','${alice}',false)`);
 expect((await db.query('select company_id from candidate_saved_companies')).rows).toEqual([{company_id:'company-a'}]);
});
it('denies anonymous access to saved company records',async()=>{
 await db.exec('reset role;set role anon');
 await expect(db.query('select * from candidate_saved_companies')).rejects.toThrow();
});
