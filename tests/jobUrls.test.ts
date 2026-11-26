import { it, expect } from "vitest";
import { jobPath, parseJobPath } from "../src/services/jobUrls.js";
it("builds the requested company/role URL using stored stable slugs", () => {
  expect(
    jobPath({
      id: "id",
      company_slug: "dun-and-bradstreet",
      role_slug: "data-analyst",
    }),
  ).toBe("/jobs/dun-and-bradstreet/data-analyst");
});
it("continues to accept legacy UUID links", () => {
  const id = "00000000-0000-4000-8000-000000000001";
  expect(parseJobPath("/jobs/" + id)).toEqual({ id });
  expect(jobPath({ id })).toBe("/jobs/" + id);
});
it("parses canonical URLs and rejects invalid paths without a broad search", () => {
  expect(parseJobPath("/jobs/zeta/security-engineer")).toEqual({
    company: "zeta",
    role: "security-engineer",
  });
  for (const p of [
    "/jobs/zeta/../jobs",
    "/jobs/a/%2fadmin",
    "/jobs/a/%E0%A4%A",
    "/jobs/not-a-uuid",
    "/companies/a/b",
  ])
    expect(parseJobPath(p)).toBeNull();
});
