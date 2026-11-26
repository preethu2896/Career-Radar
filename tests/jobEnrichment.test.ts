import { expect, it, vi } from "vitest";
import {
  collectFeed,
  type FeedBoard,
} from "../supabase/functions/_shared/jobFeeds.js";
const board: FeedBoard = {
  id: "x",
  provider: "WORKABLE",
  board_slug: "acme",
  company_name: "Acme",
};
const listing = {
  shortcode: "REAL1",
  title: "Analyst",
  country: "India",
  city: "Bengaluru",
  url: "https://apply.workable.com/j/REAL1",
};
it("requests descriptions in the complete public Workable board snapshot", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      Response.json({
        jobs: [
          {
            ...listing,
            description:
              "<p>Build Python systems. No previous experience required.</p>",
          },
        ],
      }),
    );
  const jobs = await collectFeed(board, fetcher);
  expect(fetcher.mock.calls[0]?.[0]).toContain("details=true");
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(jobs[0]?.description).toContain("Python");
  expect(jobs[0]?.experience_requirement).toContain("No previous experience");
  expect(jobs[0]?.skills).toContain("Python");
});
it("rejects a rate-limited snapshot rather than returning partial or empty jobs", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response("", { status: 429 }));
  await expect(collectFeed(board, fetcher)).rejects.toThrow("SOURCE_HTTP_429");
});
it("discovers only same-origin job pages and respects split-board ownership", async () => {
  const b: FeedBoard = {
    id: "s",
    provider: "SCHEMA",
    board_slug: "acme",
    company_name: "Acme",
    source_urls: ["https://careers.example.com/jobs/old"],
    discovery_roots: ["https://careers.example.com/jobs"],
    excluded_urls: ["https://careers.example.com/jobs/owned"],
  };
  const page = (title: string) =>
    '<script type="application/ld+json">' +
    JSON.stringify({
      "@type": "JobPosting",
      title,
      hiringOrganization: { name: "Acme" },
      description: "Real source text",
      jobLocation: {
        address: { addressLocality: "Bengaluru", addressCountry: "IN" },
      },
    }) +
    "</script>";
  const fetcher = vi
    .fn()
    .mockImplementation(
      async (url: string) =>
        new Response(
          url.endsWith("/robots.txt")
            ? "User-agent: *\nAllow: /"
            : url.endsWith("/jobs")
              ? '<a href="/jobs/new">New</a><a href="https://evil.example/jobs/x">Bad</a><a href="/jobs/owned">Other batch</a>'
              : page(url.endsWith("/new") ? "New" : "Old"),
        ),
    );
  const jobs = await collectFeed(b, fetcher);
  expect(jobs.map((j) => j.title).sort()).toEqual(["New", "Old"]);
  expect(fetcher.mock.calls.flat().join()).not.toContain("evil.example");
  expect(fetcher.mock.calls.flat().join()).not.toContain("/jobs/owned");
});
it("fails a broken careers index rather than interpreting it as mass closure", async () => {
  const fetcher = vi
    .fn()
    .mockImplementation(
      async (url: string) =>
        new Response(
          url.endsWith("/robots.txt")
            ? "User-agent: *\nAllow: /"
            : "No job links",
        ),
    );
  await expect(
    collectFeed(
      {
        id: "s",
        provider: "SCHEMA",
        board_slug: "acme",
        company_name: "Acme",
        source_urls: ["https://careers.example.com/jobs/old"],
        discovery_roots: ["https://careers.example.com/jobs"],
      },
      fetcher,
    ),
  ).rejects.toThrow("EMPTY_DISCOVERY_INDEX");
});
