import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
const db = new PGlite();
const alice = "00000000-0000-4000-8000-000000000001";
const bob = "00000000-0000-4000-8000-000000000002";
beforeAll(async () => {
  // A disposable PostgreSQL engine with minimal Supabase auth/storage contracts.
  // No credentials or connection to the configured project are used.
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(), bucket_id text, name text, owner_id text, unique(bucket_id,name));
    alter table storage.objects enable row level security;
    grant usage on schema auth,storage,public to anon,authenticated,service_role;
    grant all on storage.objects to anon,authenticated,service_role;
    insert into auth.users values ('${alice}'),('${bob}');
  `);
  for (const name of ["202610100002_candidate_profiles.sql", "202610220005_candidate_profile_extensions.sql", "202610290007_private_resumes.sql", "202611200008_resume_security.sql", "202611200009_resume_quota_owner_fix.sql"]) {
    await db.exec(readFileSync(`supabase/migrations/${name}`, "utf8"));
  }
  await db.exec("grant select,insert,update,delete on public.profiles to authenticated;");
}, 30000);
beforeEach(async () => { await db.exec("reset role; delete from storage.objects; delete from public.candidate_resumes; delete from public.resume_operation_limits; delete from public.profiles;"); });
afterAll(async () => { await db.close(); });
async function begin(user = alice, action = "upload") {
  const result = await db.query<{ token: string }>("select public.begin_resume_operation($1,$2) as token", [user, action]);
  return result.rows[0]!.token;
}
async function release(token: string, user = alice) { await db.query("select public.finish_resume_operation($1,$2)", [user, token]); }
async function insert(name: string) { await db.query("insert into storage.objects(bucket_id,name) values('candidate-resumes',$1)", [name]); }
it("blocks overlapping operations, rejects a stale lease and allows retry after release", async () => {
  const token = await begin();
  await expect(begin(alice, "remove")).rejects.toThrow("RESUME_BUSY");
  await release(token);
  await expect(db.query("select public.commit_resume_operation($1,$2,null)", [alice, token])).rejects.toThrow("STALE_RESUME_OPERATION");
  const next = await begin(alice, "remove"); expect(next).not.toBe(token);
});
it("enforces five uploads per hour without preventing deletion", async () => {
  for (let i = 0; i < 5; i++) await release(await begin());
  await expect(begin()).rejects.toThrow("RESUME_RATE_LIMIT");
  await release(await begin(alice, "remove"));
  await db.query("update public.resume_operation_limits set upload_window=now()-interval '2 hours' where user_id=$1", [alice]);
  await release(await begin());
});
it("requires a lease and enforces quota with the real Storage owner_id column present", async () => {
  await expect(insert(alice + "/first.pdf")).rejects.toThrow("RESUME_LEASE_REQUIRED");
  await begin();
  await insert(alice + "/first.pdf"); await insert(alice + "/second.pdf");
  await expect(insert(alice + "/third.pdf")).rejects.toThrow("RESUME_STORAGE_QUOTA");
});
it("prevents authenticated clients bypassing the endpoint even with broad legacy policies", async () => {
  await db.exec(`create policy legacy_allow_all on storage.objects for all to authenticated using(true) with check(true);`);
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${alice}',false);`);
  await expect(begin()).rejects.toThrow("permission denied");
  await expect(insert(alice + "/bypass.pdf")).rejects.toThrow();
  await expect(db.query("delete from public.candidate_resumes where user_id=$1", [alice])).rejects.toThrow("permission denied");
  await db.exec("reset role; drop policy legacy_allow_all on storage.objects;");
});
it("keeps reads private and rejects direct deletion despite permissive policies", async () => {
  await begin(); await insert(alice + "/private.pdf");
  await db.exec("create policy legacy_read on storage.objects for select to authenticated using(true); create policy legacy_delete on storage.objects for delete to authenticated using(true);");
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${bob}',false);`);
  expect((await db.query("select * from storage.objects")).rows).toHaveLength(0);
  await db.exec(`select set_config('request.jwt.claim.sub','${alice}',false);`);
  expect((await db.query("select * from storage.objects")).rows).toHaveLength(1);
  expect((await db.query("delete from storage.objects returning *")).rows).toHaveLength(0);
  await db.exec("reset role; drop policy legacy_read on storage.objects; drop policy legacy_delete on storage.objects;");
});

it("enforces the original profile ownership policies against direct reads and writes", async () => {
  await db.query("insert into public.profiles(id,first_name) values($1,'Alice')", [alice]);
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${bob}',false);`);
  expect((await db.query("select * from public.profiles")).rows).toHaveLength(0);
  expect((await db.query("update public.profiles set first_name='changed' returning *")).rows).toHaveLength(0);
  await expect(db.query("insert into public.profiles(id) values($1)", [alice])).rejects.toThrow();
  await db.query("insert into public.profiles(id,first_name) values($1,'Bob')", [bob]);
  expect((await db.query("select first_name from public.profiles")).rows).toEqual([{ first_name: "Bob" }]);
  await db.exec("reset role;");
});
