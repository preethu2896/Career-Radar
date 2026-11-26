import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
const db = new PGlite();
const alice = "00000000-0000-4000-8000-000000000001";
beforeAll(async () => {
  await db.exec(
    `create table public.profiles(id uuid primary key,first_name text,career_stage text,experience_level text,target_roles jsonb default '[]',skills jsonb default '[]',preferred_cities jsonb default '[]',work_preferences jsonb default '[]',education_degree text,graduation_year integer,education_score text,onboarding_complete boolean default false);create table public.candidate_resumes(user_id uuid);`,
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/202611200011_required_profile_setup.sql",
      "utf8",
    ),
  );
}, 30000);
beforeEach(async () => {
  await db.exec(
    `delete from profiles;delete from candidate_resumes;insert into candidate_resumes values('${alice}');insert into profiles(id,first_name,career_stage,target_roles,preferred_cities,work_preferences,education_degree,graduation_year,education_score,onboarding_complete) values('${alice}','Asha','Student / Fresher','["Data Analyst"]','["Bengaluru"]','["Hybrid"]','B.Com',2026,'75%',true)`,
  );
});
afterAll(() => db.close());
it.each([
  ["first_name=null", "first name"],
  ["target_roles='[]'", "roles"],
  ["preferred_cities='[]'", "location"],
  ["work_preferences='[]'", "preference"],
  ["career_stage=null", "career stage"],
  ["education_degree=' '", "degree"],
  ["graduation_year=null", "graduation year"],
  ["education_score=''", "marks"],
  ["education_score='11 CGPA'", "marks"],
  ["education_score='101%'", "marks"],
  ["career_stage='Early career',experience_level=null", "experience"],
  ["career_stage='Career switcher',experience_level='71 years'", "experience"],
])("rejects incomplete completed profiles: %s", async (update, error) => {
  await expect(db.exec(`update profiles set ${update}`)).rejects.toThrow(
    new RegExp(error, "i"),
  );
});
it("checks a real saved resume instead of trusting the filename", async () => {
  await db.exec("delete from candidate_resumes");
  await expect(
    db.exec("update profiles set onboarding_complete=true"),
  ).rejects.toThrow(/resume/);
});
it("accepts fractional experience, CGPA and optional empty skills", async () => {
  await db.exec(
    "update profiles set career_stage='Career switcher',experience_level='1.5 years',education_score='8.2 CGPA',skills='[]'",
  );
  await db.exec("update profiles set education_score='8.2/10'");
  await db.exec("update profiles set education_score='CGPA: 8.2/10'");
  await db.exec("update profiles set education_score='GPA: 3.7/4'");
  await expect(
    db.exec("update profiles set education_score='GPA: 5/4'"),
  ).rejects.toThrow(/marks/);
});
it("permits partial signup profiles", async () => {
  await db.exec(
    "insert into profiles(id)values('00000000-0000-4000-8000-000000000002')",
  );
});
