import{PGlite}from'@electric-sql/pglite';import{readFileSync}from'node:fs';import{it,expect}from'vitest';
it('enforces three per-account apply unlocks and service-only paid entitlements',async()=>{
 const db=new PGlite();try{
 await db.exec("create role anon;create role authenticated;create role service_role;create table public.candidate_accounts(id uuid primary key);create table public.career_opportunities(id uuid);grant select on public.career_opportunities to anon,authenticated;");
 await db.exec(readFileSync('supabase/migrations/202611260001_application_access.sql','utf8'));
 const a='00000000-0000-4000-a000-000000000001',b='00000000-0000-4000-a000-000000000002';await db.query('insert into candidate_accounts values($1),($2)',[a,b]);
 const access=async(id:string,job:string|null,consume=false)=>(await db.query<{access:any}>('select public.check_candidate_link_access($1,$2,$3) as access',[id,job,consume])).rows[0]!.access;
 expect(await access(a,'one')).toMatchObject({paid:false,remaining:3,unlocked:false});
 expect(await access(a,'one',true)).toMatchObject({remaining:2,unlocked:true});
 expect(await access(a,'one',true)).toMatchObject({remaining:2,unlocked:true});
 await access(a,'two',true);await access(a,'three',true);
 expect(await access(a,'four',true)).toMatchObject({remaining:0,unlocked:false});
 expect(await access(b,'one')).toMatchObject({remaining:3,unlocked:false});
 expect(await access(a,null)).toMatchObject({unlocked:false,paid:false});
 await db.query("update candidate_link_access set paid_until=now()+interval '1 day' where user_id=$1",[a]);expect(await access(a,null)).toMatchObject({paid:true,unlocked:true});expect(await access(a,'four',true)).toMatchObject({unlocked:true,remaining:0});
 await db.query("update candidate_link_access set paid_until=now()-interval '1 day' where user_id=$1",[a]);expect(await access(a,'four')).toMatchObject({unlocked:false});expect(await access(a,'one')).toMatchObject({unlocked:true});
 await db.exec('set role authenticated');await expect(access(b,'fifth',true)).rejects.toThrow(/permission denied/);await expect(db.query('select * from candidate_apply_unlocks')).rejects.toThrow(/permission denied/);await expect(db.query('update candidate_link_access set paid_until=now()')).rejects.toThrow(/permission denied/);await expect(db.query('select * from career_opportunities')).rejects.toThrow(/permission denied/);
 }finally{await db.close();}
},30000);
