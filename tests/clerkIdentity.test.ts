import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, it, expect } from "vitest";
const db = new PGlite();
const alice = "00000000-0000-4000-8000-000000000001",
  bob = "00000000-0000-4000-8000-000000000002";
beforeAll(async () => {
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;create table auth.users(id uuid primary key);create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt()returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;create function storage.foldername(name text)returns text[]language sql immutable as $$select(string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1]$$;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner_id text,unique(bucket_id,name));alter table storage.objects enable row level security;grant usage on schema public,auth,storage to anon,authenticated,service_role;grant all on storage.objects to anon,authenticated,service_role;insert into auth.users values('${alice}'),('${bob}');`,
  );
  for (const name of [
    "202610100002_candidate_profiles.sql",
    "202610220005_candidate_profile_extensions.sql",
    "202610290007_private_resumes.sql",
    "202611200008_resume_security.sql",
    "202611200009_resume_quota_owner_fix.sql",
    "202611200010_candidate_workspace.sql",
    "202611200012_clerk_identity.sql",
    "202611260002_account_settings.sql",
  ])
    await db.exec(readFileSync("supabase/migrations/" + name, "utf8"));
  await db.exec(
    `grant select,insert,update,delete on public.profiles to authenticated;insert into public.candidate_identity_providers values('https://clerk.example','clerk'),('https://supabase.example/auth/v1','supabase');insert into public.candidate_identity_links values('https://clerk.example','user_alice','${alice}'),('https://clerk.example','user_bob','${bob}');insert into public.profiles(id,first_name)values('${alice}','Alice'),('${bob}','Bob');select public.begin_resume_operation('${alice}','upload');select public.begin_resume_operation('${bob}','upload');insert into storage.objects(bucket_id,name)values('candidate-resumes','${alice}/a.pdf'),('candidate-resumes','${bob}/b.pdf');`,
  );
}, 30000);
afterAll(() => db.close());
async function claims(issuer: string, sub: string) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claims',$1,false)", [
    JSON.stringify({ iss: issuer, sub, role: "authenticated" }),
  ]);
  await db.exec("set role authenticated");
}
it("keeps imported identities on their original UUID and profile", async () => {
  await claims("https://clerk.example", "user_alice");
  expect((await db.query("select id from profiles")).rows).toEqual([
    { id: alice },
  ]);
});
it("keeps resume object reads private with string Clerk IDs", async () => {
  await claims("https://clerk.example", "user_bob");
  expect((await db.query("select name from storage.objects")).rows).toEqual([
    { name: bob + "/b.pdf" },
  ]);
});
it("rejects unknown issuers and unmapped Clerk subjects even with a victim UUID", async () => {
  for (const [issuer, sub] of [
    ["https://attacker.example", alice],
    ["https://clerk.example", alice],
    ["https://clerk.example", "user_unknown"],
  ]) {
    await claims(issuer!, sub!);
    expect((await db.query("select id from profiles")).rows).toEqual([]);
  }
});
it("keeps legacy Supabase sign-in working for rollback", async () => {
  await claims("https://supabase.example/auth/v1", alice);
  expect((await db.query("select id from profiles")).rows).toEqual([
    { id: alice },
  ]);
});
it("prevents clients from provisioning or changing identity links", async () => {
  await claims("https://clerk.example", "user_alice");
  await expect(
    db.query(
      "select public.ensure_clerk_candidate('https://clerk.example','user_victim','','')",
    ),
  ).rejects.toThrow();
  await expect(
    db.query("select * from candidate_identity_links"),
  ).rejects.toThrow();
  await expect(
    db.query(
      "insert into candidate_identity_links values('https://clerk.example','user_thief',$1)",
      [bob],
    ),
  ).rejects.toThrow();
});
it("provisions idempotently without accepting an account ID or matching on email", async () => {
  await db.exec("reset role");
  const query =
    "select public.ensure_clerk_candidate('https://clerk.example','user_new','New','') as id";
  const one = (await db.query<{ id: string }>(query)).rows[0]!.id;
  const two = (await db.query<{ id: string }>(query)).rows[0]!.id;
  expect(one).toBe(two);
  expect([alice, bob]).not.toContain(one);
});

it('prevents deleted Clerk identities from recreating profiles while preserving other accounts',async()=>{
 await db.exec('reset role');
 const result:any=await db.query("select public.ensure_clerk_candidate('https://clerk.example','user_delete_test','QA','') as id");const id=result.rows[0].id;
 await db.query('insert into public.candidate_settings(user_id,product_updates)values($1,true)',[id]);
 await db.query("insert into public.candidate_deleted_identities(issuer,subject)values('https://clerk.example','user_delete_test')");
 await db.query('delete from public.candidate_accounts where id=$1',[id]);
 expect((await db.query('select * from public.candidate_settings where user_id=$1',[id])).rows).toEqual([]);
 await expect(db.query("select public.ensure_clerk_candidate('https://clerk.example','user_delete_test','','')")).rejects.toThrow('ACCOUNT_DELETING');
 expect((await db.query('select id from public.profiles where id=$1',[bob])).rows).toEqual([{id:bob}]);
 await claims('https://clerk.example','user_bob');
 await expect(db.query('select * from public.candidate_settings')).rejects.toThrow();
 await expect(db.query('select * from public.candidate_deleted_identities')).rejects.toThrow();
});
