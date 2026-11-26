import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, expect, it } from "vitest";
const db = new PGlite();
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
  await db.exec(
    `insert into candidate_resumes values('00000000-0000-4000-8000-000000000001');insert into profiles values('00000000-0000-4000-8000-000000000001','Asha','Student / Fresher',null,'["Data Analyst"]','["SQL"]','["Bengaluru"]','["Hybrid"]','B.Com',2026,'75%',true)`,
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/202611230021_optional_profile_setup.sql",
      "utf8",
    ),
  );
}, 30000);
afterAll(() => db.close());
it("preserves existing profile details and resume records during migration", async () => {
  const row = (
    await db.query<any>("select * from profiles where first_name='Asha'")
  ).rows[0];
  expect(row.education_degree).toBe("B.Com");
  expect(row.skills).toEqual(["SQL"]);
  expect(row.education_score).toBe("75%");
  expect((await db.query("select * from candidate_resumes")).rows).toHaveLength(
    1,
  );
});
it("allows a new user to skip all career fields without a resume", async () => {
  await db.exec(
    `insert into profiles(id,onboarding_complete)values('00000000-0000-4000-8000-000000000002',true)`,
  );
  expect(
    (
      await db.query<any>(
        "select onboarding_complete from profiles where id='00000000-0000-4000-8000-000000000002'",
      )
    ).rows[0].onboarding_complete,
  ).toBe(true);
});
it.each([
  ["target_roles", `'["A","B","C","D"]'`],
  ["skills", `'[5]'`],
  ["preferred_cities", `'{}'`],
  ["work_preferences", `'["Anywhere"]'`],
])("still rejects malformed %s", async (field, value) => {
  await expect(
    db.exec(`update profiles set ${field}=${value} where first_name='Asha'`),
  ).rejects.toThrow();
});
