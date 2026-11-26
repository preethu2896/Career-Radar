// Opt-in integration checks. Creates only disposable QA users with the public
// app key; credentials remain in memory. Cleanup is scoped to exact QA emails.
// Run: node --env-file=.env.local scripts/qa-live.mjs
import assert from "node:assert/strict";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { chromium, expect } from "@playwright/test";
const projectRef = "fahvirvrmozvkanmuwnu";
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;
assert.equal(
  new URL(url).hostname,
  projectRef + ".supabase.co",
  "Unexpected QA target",
);
const origin = process.env.CR_QA_ORIGIN || "http://localhost:5173";
const runId = randomUUID();
const makeClient = () =>
  createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) =>
        fetch(input, { ...init, signal: AbortSignal.timeout(25000) }),
    },
  });
const accounts = [0, 1, 2].map((index) => ({
  email: `qa-${runId}-${index}@example.com`,
  password: `Qa!8aA${randomBytes(24).toString("base64url")}`,
  client: makeClient(),
  id: null,
}));
const artifacts = resolve("qa-artifacts");
await mkdir(artifacts, { recursive: true });
const reports = [];
const pass = (name) => {
  reports.push({ check: name, passed: true });
  console.log("PASS: " + name);
};
const unwrap = (result) => {
  if (result.error) throw new Error(result.error.message);
  return result.data;
};
const digest = (data) => createHash("sha256").update(data).digest("hex");
async function until(check, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Timed out waiting for persisted data");
}
function pdf(version) {
  const stream = `BT /F1 14 Tf 40 740 Td (QA Candidate ${version}) Tj 0 -24 Td (Data Analyst SQL Excel Python Docker React LangGraph Tally Power BI Communication Figma) Tj 0 -24 Td (EDUCATION) Tj 0 -24 Td (Bachelor of Engineering in Computer Science and Design CGPA: 8.26 / 10) Tj 0 -24 Td (Example University, August 2021 - May 2025) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const start = Buffer.byteLength(body);
  body += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((offset) => String(offset).padStart(10, "0") + " 00000 n ")
    .join(
      "\n",
    )}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return Buffer.from(body);
}
async function metadata(account) {
  return unwrap(
    await account.client
      .from("candidate_resumes")
      .select("*")
      .eq("user_id", account.id)
      .maybeSingle(),
  );
}
async function tracker(account) {
  return unwrap(
    await account.client
      .from("candidate_applications")
      .select("*")
      .eq("user_id", account.id),
  );
}
async function screenshot(page, name) {
  await page.screenshot({
    path: resolve(artifacts, name + ".png"),
    fullPage: true,
    animations: "disabled",
  });
}
async function checkLayout(page, name, { onboarding = false } = {}) {
  const measurements = await page.evaluate(() => {
    const root = document.documentElement;
    const visible = (element) => element.getClientRects().length > 0;
    const panels = [...document.querySelectorAll(".cr-setup *")]
      .filter(
        (element) =>
          visible(element) &&
          ["auto", "scroll"].includes(getComputedStyle(element).overflowY) &&
          element.scrollHeight > element.clientHeight + 2,
      )
      .map((element) => element.className);
    const overflow = [
      ...document.querySelectorAll(
        ".cr-setup-form,.cr-workspace-header,.cr-workspace-body,.auth-form",
      ),
    ]
      .filter(visible)
      .filter(
        (element) =>
          element.getBoundingClientRect().right > innerWidth + 2 ||
          element.getBoundingClientRect().left < -2,
      )
      .map((element) => element.className);
    return {
      width: innerWidth,
      height: innerHeight,
      documentWidth: root.scrollWidth,
      documentHeight: root.scrollHeight,
      panels,
      overflow,
    };
  });
  assert.ok(
    measurements.documentWidth <= measurements.width + 2,
    `Horizontal overflow in ${name}: ${JSON.stringify(measurements)}`,
  );
  assert.deepEqual(measurements.overflow, [], `Container alignment in ${name}`);
  if (onboarding)
    assert.deepEqual(measurements.panels, [], `Nested scrolling in ${name}`);
  reports.push({ check: name, passed: true, measurements });
}
let browser, context, page, failure;
try {
  // Verify the server, rather than our UI helper, rejects weak passwords.
  for (const password of ["Aa1!", "lowercaseonlypassword"]) {
    const client = makeClient();
    const response = await client.auth.signUp({
      email: `qa-weak-${runId}@example.com`,
      password,
      options: { data: { qa_run: runId } },
    });
    assert.ok(response.error, "Supabase accepted a weak password");
    assert.match(response.error.message, /password/i);
  }
  pass("Supabase enforces password length and required character types");
  for (const account of accounts.slice(0, 2)) {
    const data = unwrap(
      await account.client.auth.signUp({
        email: account.email,
        password: account.password,
        options: {
          data: { first_name: "QA", last_name: "Candidate", qa_run: runId },
        },
      }),
    );
    assert.ok(
      data.session,
      "Disposable user requires email confirmation; stop instead of bypassing it",
    );
    account.id = data.user.id;
  }
  const [a, b, c] = accounts;
  browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.setDefaultTimeout(15000);
  for (const size of [
    { width: 1440, height: 900 },
    { width: 1280, height: 720 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
    { width: 360, height: 640 },
    { width: 320, height: 568 },
  ]) {
    await page.setViewportSize(size);
    await page.goto(origin + "/signup");
    await page.evaluate(() => document.fonts.ready);
    const dimensions = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
    }));
    assert.ok(
      dimensions.width <= dimensions.viewportWidth + 2,
      "Signup horizontal overflow: " + JSON.stringify(size),
    );
    assert.ok(
      dimensions.height <= dimensions.viewportHeight + 2,
      "Signup vertical overflow: " + JSON.stringify({ ...size, ...dimensions }),
    );
    await expect(
      page.getByRole("button", { name: "Create account", exact: true }),
    ).toBeInViewport();
    await expect(
      page.getByRole("button", { name: "Log in", exact: true }),
    ).toBeInViewport();
    await screenshot(page, `signup-${size.width}-${size.height}`);
  }
  pass(
    "Signup fits desktop, tablet and phone screens without page overflow or clipped actions",
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(origin + "/signup");
  await expect(
    page.getByText("Password must contain:", { exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("First name", { exact: true }).fill("QA");
  await page.getByLabel("Last name", { exact: false }).fill("Candidate");
  await page
    .getByLabel("Email address", { exact: true })
    .fill(`qa-unused-${runId}@example.com`);
  await page.getByLabel("Password", { exact: true }).fill("Aa1!");
  await page.getByLabel("Confirm password", { exact: true }).fill("Aa1!");
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByText("Use at least 8 characters.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Password must contain:", { exact: true }),
  ).toHaveCount(0);
  pass("Signup hides the checklist and shows the specific submit-time error");
  await screenshot(page, "signup-desktop");
  // Test actual UI account creation. Only attach a QA marker for scoped cleanup.
  await page.route("**/auth/v1/signup*", async (route) => {
    const body = route.request().postDataJSON();
    await route.continue({
      postData: JSON.stringify({
        ...body,
        data: { ...body.data, qa_run: runId },
      }),
    });
  });
  await page.getByLabel("Email address", { exact: true }).fill(c.email);
  await page.getByLabel("Password", { exact: true }).fill(c.password);
  await page.getByLabel("Confirm password", { exact: true }).fill("Mismatch8!");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByText("Passwords do not match.", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Confirm password", { exact: true }).fill(c.password);
  await page.getByRole("checkbox").uncheck();
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByText("Accept the terms to create your account.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("checkbox").check();
  const signupResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/auth/v1/signup") &&
      response.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  const signupBody = await (await signupResponse).json();
  c.id = signupBody.user?.id ?? signupBody.id;
  assert.ok(c.id, "UI signup must return a real user");
  const cLogin = unwrap(
    await c.client.auth.signInWithPassword({
      email: c.email,
      password: c.password,
    }),
  );
  assert.equal(cLogin.user.id, c.id);
  await page.waitForURL("**/onboarding");
  pass(
    "Real UI signup creates an account and rejects mismatched passwords and missing consent",
  );
  await context.close();
  context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  page = await context.newPage();
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.setDefaultTimeout(15000);
  for (const path of ["/dashboard", "/onboarding", "/profile"]) {
    await page.goto(origin + path);
    await page.waitForURL(url => url.pathname === "/login");
  }
  await page.getByLabel("Email address", { exact: true }).fill(a.email);
  await page.getByLabel("Password", { exact: true }).fill("WrongPassword8!");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Those details do not match",
  );
  pass(
    "Anonymous protected routes redirect to login and invalid credentials show a useful error",
  );

  await page.goto(origin + "/login");
  await page.getByLabel("Email address", { exact: true }).fill(a.email);
  await page.getByLabel("Password", { exact: true }).fill(a.password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.waitForURL("**/onboarding");
  await expect(
    page.getByRole("heading", { name: "Choose your direction." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Choose one to three roles.",
  );
  const warningStyle = await page.getByRole("alert").evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      background: style.backgroundColor,
      border: style.borderTopWidth,
      color: style.color,
    };
  });
  assert.equal(warningStyle.background, "rgba(0, 0, 0, 0)");
  assert.equal(warningStyle.border, "0px");
  assert.equal(warningStyle.color, "rgb(180, 35, 24)");
  pass("Missing required roles show a plain red warning without an alert box");
  await page
    .getByRole("combobox", { name: "Search or add a role" })
    .fill("Data");
  await page.getByRole("option", { name: "Data Analyst", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Remove Data Analyst", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Search or add a role" }),
  ).toHaveValue("");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Where would you like to work?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Bengaluru", exact: true }).click();
  await page.getByRole("button", { name: "Hybrid", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Start with your resume." }),
  ).toBeVisible();
  const pdf1 = pdf("one"),
    pdf2 = pdf("two");
  await page.locator("input[type=file]").setInputFiles({
    name: "qa-resume.pdf",
    mimeType: "application/pdf",
    buffer: pdf1,
  });
  await expect(page.getByText("Saved privately", { exact: true })).toBeVisible({
    timeout: 30000,
  });
  const saved1 = await metadata(a);
  assert.ok(saved1?.storage_path.startsWith(a.id + "/"));
  const original = unwrap(
    await a.client.storage
      .from("candidate-resumes")
      .download(saved1.storage_path),
  );
  assert.equal(digest(Buffer.from(await original.arrayBuffer())), digest(pdf1));
  assert.equal(
    unwrap(
      await b.client.from("candidate_resumes").select("*").eq("user_id", a.id),
    ).length,
    0,
  );
  assert.ok(
    (
      await b.client.storage
        .from("candidate-resumes")
        .download(saved1.storage_path)
    ).error,
  );
  assert.ok(
    (
      await a.client.storage
        .from("candidate-resumes")
        .upload(a.id + "/bypass.pdf", pdf1, { contentType: "application/pdf" })
    ).error,
  );
  pass(
    "Browser résumé upload/download works and cross-account/direct-write access is blocked",
  );
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("First name", { exact: true }).fill("QA");
  await page.getByLabel("Last name", { exact: false }).fill("Candidate");
  await page
    .getByRole("combobox", { name: "Career stage", exact: true })
    .click();
  await page
    .getByRole("option", { name: "Student / Fresher", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Career stage", exact: true })
    .click();
  await page.getByRole("option", { name: "Early career", exact: true }).click();
  await page.getByLabel("Years of experience", { exact: true }).fill("");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("years of experience");
  await page.getByLabel("Years of experience", { exact: true }).fill("1.5");
  await page
    .getByRole("combobox", { name: "Career stage", exact: true })
    .press("Enter");
  await page
    .getByRole("combobox", { name: "Career stage", exact: true })
    .press("Home");
  await page
    .getByRole("combobox", { name: "Career stage", exact: true })
    .press("Enter");
  await expect(
    page.getByRole("combobox", { name: "Career stage", exact: true }),
  ).toHaveText("Student / Fresher");
  await expect(
    page.getByLabel("Years of experience", { exact: true }),
  ).toHaveCount(0);
  pass(
    "Styled career dropdown supports keyboard selection and requires experience for non-freshers",
  );

  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByLabel("Degree / qualification", { exact: true }),
  ).toHaveValue("Bachelor of Engineering in Computer Science and Design");
  await expect(page.getByLabel("Marks / CGPA", { exact: true })).toHaveValue(
    "8.26",
  );
  await expect(page.getByLabel("Graduation year", { exact: true })).toHaveValue(
    "2025",
  );
  pass(
    "Resume extraction separates degree, numeric CGPA and the graduation end year",
  );

  await page.getByLabel("Graduation year", { exact: true }).fill("");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Choose your direction.", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "About you", exact: true }).click();
  await page.getByRole("button", { name: "Education", exact: true }).click();
  await expect(page.getByLabel("Graduation year", { exact: true })).toHaveValue(
    "2025",
  );
  pass("Missing education is recovered from the owned saved PDF after reload");
  await page
    .getByLabel("Degree / qualification", { exact: false })
    .fill("B.Com");
  await page.getByLabel("Graduation year", { exact: false }).fill("2026");
  await page.getByLabel("Marks / CGPA", { exact: false }).fill("75");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  const skill = page.getByLabel("Add a skill", { exact: true });
  if (await skill.isEnabled()) {
    await skill.fill("Kuber");
    await page.getByRole("option", { name: "Kubernetes", exact: true }).click();
  }
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your radar, ready to go." }),
  ).toBeVisible();
  await expect(
    page.getByText("Employer responses are never guaranteed.", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Open my radar", exact: true })
    .click();
  await page.waitForURL("**/dashboard");
  await until(
    async () =>
      unwrap(
        await a.client.from("profiles").select("*").eq("id", a.id).single(),
      ).onboarding_complete,
  );
  const profile = unwrap(
    await a.client.from("profiles").select("*").eq("id", a.id).single(),
  );
  assert.deepEqual(profile.target_roles, ["Data Analyst"]);
  assert.equal(profile.graduation_year, 2026);
  assert.equal(profile.education_degree, "B.Com");
  assert.equal(profile.education_score, "75");
  assert.equal(profile.phone, null);
  assert.equal(profile.github_url, null);
  assert.ok(
    profile.skills.length > 5,
    "Extracted skills must not be trimmed to five",
  );
  assert.ok(
    profile.skills.includes("Kubernetes"),
    "Skill suggestions must save",
  );
  const rejectedPreferences = await a.client
    .from("profiles")
    .update({ preferred_cities: [] })
    .eq("id", a.id);
  assert.ok(
    rejectedPreferences.error?.message.includes("preferred location"),
    "Supabase must reject missing required preferences",
  );
  const rejectedResume = await b.client.from("profiles").upsert({
    id: b.id,
    first_name: "QA",
    last_name: "",
    career_stage: "Student / Fresher",
    experience_level: "No professional experience",
    target_roles: ["Data Analyst"],
    skills: [],
    preferred_cities: ["Bengaluru"],
    work_preferences: ["Hybrid"],
    education_degree: "B.Com",
    graduation_year: 2026,
    education_score: "75%",
    onboarding_complete: true,
  });
  assert.ok(
    rejectedResume.error?.message.includes("resume"),
    "Supabase must require a real saved PDF",
  );
  pass(
    "Supabase rejects incomplete preferences and completed profiles without a saved resume",
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Your radar, QA." }),
  ).toBeVisible();
  pass(
    "Required-resume onboarding saves roles, education and preferences to Supabase and survives reload",
  );
  await page.getByRole("button", { name: /^Tracker/ }).click();
  await page.getByRole("button", { name: "+ Add a role", exact: true }).click();
  await page
    .getByRole("button", { name: "Add to tracker", exact: true })
    .click();
  await expect(page.getByRole("alert")).toHaveText("Add a company name.");
  await page.getByLabel("Company", { exact: true }).fill("QA Example");
  await page.getByLabel("Role", { exact: true }).fill("QA Data Analyst");
  await page
    .getByLabel("Job link", { exact: false })
    .fill("https://example.com/qa-role");
  await page
    .getByRole("button", { name: "Add to tracker", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "QA Data Analyst", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Stage for QA Data Analyst", { exact: true })
    .selectOption("Applied");
  await until(async () => (await tracker(a))[0]?.status === "Applied");
  const applied = (await tracker(a))[0];
  assert.ok(applied.applied_at);
  assert.equal(
    unwrap(
      await b.client
        .from("candidate_applications")
        .select("*")
        .eq("id", applied.id),
    ).length,
    0,
  );
  assert.equal(
    unwrap(
      await b.client
        .from("candidate_applications")
        .update({ status: "Offer" })
        .eq("id", applied.id)
        .select("*"),
    ).length,
    0,
  );
  await page
    .getByRole("button", { name: "Notes & next step", exact: true })
    .click();
  await page
    .getByLabel("Private notes for QA Data Analyst", { exact: true })
    .fill("QA follow-up note");
  await page.getByRole("button", { name: "Save notes", exact: true }).click();
  await until(async () => (await tracker(a))[0]?.notes === "QA follow-up note");
  assert.equal((await tracker(a))[0].applied_at, applied.applied_at);
  await page.reload();
  await page.getByRole("button", { name: /^Tracker/ }).click();
  await expect(
    page.getByLabel("Stage for QA Data Analyst", { exact: true }),
  ).toHaveValue("Applied");
  await page
    .getByRole("button", { name: "Notes & next step", exact: true })
    .click();
  await expect(
    page.getByLabel("Private notes for QA Data Analyst", { exact: true }),
  ).toHaveValue("QA follow-up note");
  pass(
    "Application creation, stages, private notes, ownership and reload persistence work against Supabase",
  );
  await page.getByRole("button", { name: "Your profile", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByText("Saved privately", { exact: true }),
  ).toBeVisible();
  await page.locator("input[type=file]").setInputFiles({
    name: "qa-resume-v2.pdf",
    mimeType: "application/pdf",
    buffer: pdf2,
  });
  await expect(
    page.getByText("qa-resume-v2.pdf", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Saved privately", { exact: true }),
  ).toBeVisible();
  const saved2 = await metadata(a);
  assert.notEqual(saved1.storage_path, saved2.storage_path);
  const remaining = unwrap(
    await a.client.storage.from("candidate-resumes").list(a.id),
  );
  assert.equal(remaining.length, 1, "Replacement should leave one stored PDF");
  assert.equal(remaining[0].name, saved2.storage_path.split("/").at(-1));
  assert.ok(
    (
      await a.client.storage
        .from("candidate-resumes")
        .download(
          saved1.storage_path,
          { cacheNonce: randomUUID() },
          { cache: "no-store" },
        )
    ).error,
  );
  const replacement = unwrap(
    await a.client.storage
      .from("candidate-resumes")
      .download(saved2.storage_path),
  );
  assert.equal(
    digest(Buffer.from(await replacement.arrayBuffer())),
    digest(pdf2),
  );
  await page.getByRole("button", { name: "About you", exact: true }).click();
  await page.getByRole("button", { name: "Education", exact: true }).click();
  await expect(
    page.getByLabel("Graduation year", { exact: false }),
  ).toHaveValue("2026");
  pass(
    "Profile editing restores saved fields; résumé replacement removes the old object",
  );
  // Exercise every section at representative Windows, tablet and phone sizes.
  const sizes = [
    { name: "desktop", width: 1440, height: 900 },
    { name: "laptop", width: 1280, height: 720 },
    { name: "tablet", width: 1024, height: 768 },
    { name: "tablet-portrait", width: 768, height: 1024 },
    { name: "mobile", width: 390, height: 844 },
    { name: "mobile-small", width: 320, height: 640 },
  ];
  for (const size of sizes) {
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.goto(origin + "/profile");
    await expect(
      page.getByRole("heading", { name: "Choose your direction." }),
    ).toBeVisible();
    await page
      .getByRole("combobox", { name: "Search or add a role" })
      .fill("Dev");
    await expect(
      page.getByRole("listbox", { name: "Suggested roles" }),
    ).toBeVisible();
    const position = await page.evaluate(() => ({
      input: document.querySelector("[role=combobox]").getBoundingClientRect()
        .bottom,
      results: document.querySelector("[role=listbox]").getBoundingClientRect()
        .top,
    }));
    assert.ok(
      position.results >= position.input,
      `Role suggestions opened above the field at ${size.name}`,
    );
    await checkLayout(page, size.name + " role suggestions", {
      onboarding: true,
    });
    await screenshot(page, size.name + "-roles");
    await page
      .getByRole("combobox", { name: "Search or add a role" })
      .press("Escape");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await checkLayout(page, size.name + " preferences", { onboarding: true });
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    for (const section of [
      "Resume",
      "About you",
      "Education",
      "Skills",
      "Links",
    ]) {
      await page
        .getByRole("navigation", { name: "Background sections" })
        .getByRole("button", { name: section, exact: true })
        .click();
      await checkLayout(page, size.name + " " + section, { onboarding: true });
      if (section === "About you") {
        const dropdown = page.getByRole("combobox", {
          name: "Career stage",
          exact: true,
        });
        await dropdown.click();
        const list = page.getByRole("listbox", {
          name: "Career stage options",
          exact: true,
        });
        await expect(list).toBeVisible();
        assert.ok(
          (await list.boundingBox()).y >=
            (await dropdown.boundingBox()).y +
              (await dropdown.boundingBox()).height,
          "Career menu must open below its field",
        );
        await checkLayout(page, size.name + " career dropdown", {
          onboarding: true,
        });
        await screenshot(page, size.name + "-career-dropdown");
        await dropdown.press("Escape");
      }

      if (section === "About you")
        await screenshot(page, size.name + "-background");
    }
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await checkLayout(page, size.name + " review", { onboarding: true });
    await page
      .getByRole("button", { name: "Back to radar", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Your radar, QA." }),
    ).toBeVisible();
    await expect(
      page.getByText("Checking sources…", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByText("Loading your next step…", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Download resume", exact: true }),
    ).toBeVisible();
    await checkLayout(page, size.name + " dashboard");
    await screenshot(page, size.name + "-dashboard");
    await page.getByRole("button", { name: /^Tracker/ }).click();
    await expect(
      page.getByRole("heading", { name: "QA Data Analyst", exact: true }),
    ).toBeVisible();
    await checkLayout(page, size.name + " tracker");
  }
  pass(
    "All onboarding sections, role suggestions, dashboard and tracker align at six desktop/tablet/mobile sizes",
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "Your radar", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download resume", exact: true })
    .click();
  const download = await downloadPromise;
  assert.equal(digest(await readFile(await download.path())), digest(pdf2));
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Remove stored resume", exact: true })
    .click();
  await expect(page.getByText("No saved PDF.", { exact: true })).toBeVisible();
  assert.equal(await metadata(a), null);
  assert.equal(
    unwrap(await a.client.storage.from("candidate-resumes").list(a.id)).length,
    0,
  );
  await page.getByRole("button", { name: /^Tracker/ }).click();
  await page
    .getByRole("button", { name: "Notes & next step", exact: true })
    .click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Remove role", exact: true }).click();
  await until(async () => (await tracker(a)).length === 0);
  pass(
    "Dashboard résumé download/removal and tracker removal complete and leave no test objects",
  );
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.goto(origin + "/dashboard");
  await page.waitForURL(url => url.pathname === "/login");
  await page.getByLabel("Email address", { exact: true }).fill(b.email);
  await page.getByLabel("Password", { exact: true }).fill(b.password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.waitForURL("**/onboarding");
  await expect(page.getByText("0/3 selected", { exact: true })).toBeVisible();
  await page.goto(origin + "/explore");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.goto(origin + "/forgot-password");
  await page.getByLabel("Email address", { exact: true }).fill("bad-email");
  await page
    .getByRole("button", { name: "Send reset link", exact: true })
    .click();
  await expect(
    page.getByText("Enter a valid email address.", { exact: true }),
  ).toBeVisible();
  // Exercise the recovery UI without sending email or claiming mail delivery works.
  await page.route("**/auth/v1/recover*", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await page.getByLabel("Email address", { exact: true }).fill(a.email);
  await page
    .getByRole("button", { name: "Send reset link", exact: true })
    .click();
  await expect(
    page.getByText(
      "If an account uses that email, reset instructions will arrive shortly.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.goto(origin + "/reset-password");
  await page.getByLabel("New password", { exact: true }).fill("Aa1!");
  await page.getByLabel("Confirm password", { exact: true }).fill("Aa1!");
  await page
    .getByRole("button", { name: "Update password", exact: true })
    .click();
  await expect(
    page.getByText("Use at least 8 characters.", { exact: true }),
  ).toBeVisible();
  pass(
    "Sign-out protects private routes and switching accounts does not restore another candidate’s draft",
  );
  pass(
    "Password reset screens validate inputs and handle a simulated recovery response; email delivery is not tested",
  );
  assert.deepEqual(pageErrors, [], "Browser runtime errors");
  pass("No browser runtime errors during the tested flow");
} catch (error) {
  failure = error;
  console.error(
    "QA FAILED: " +
      accounts.reduce(
        (message, account) =>
          message.replaceAll(account.password, "[redacted]"),
        error.message,
      ),
  );
  if (page) await screenshot(page, "failure").catch(() => {});
} finally {
  await context?.close().catch(() => {});
  await browser?.close().catch(() => {});
  // Remove only owned QA PDFs through the Storage API before deleting users.
  let cleaned = true;
  for (const account of accounts) {
    if (!account.id) continue;
    try {
      // Sign-out checks revoke earlier sessions. Reauthenticate only the QA owner for cleanup.
      const cleanupAuth=await account.client.auth.signInWithPassword({email:account.email,password:account.password});
      if(cleanupAuth.error)throw cleanupAuth.error;
      const result = await account.client.functions.invoke("manage-resume", {
        method: "DELETE",
      });
      if (result.error) throw result.error;
    } catch {
      cleaned = false;
      console.error(
        "QA cleanup: resume endpoint needs retry for a disposable user.",
      );
    }
  }
  if (cleaned) {
    const sql = `delete from auth.users where email in (${[...accounts.map((account) => account.email), `qa-weak-${runId}@example.com`].map((email) => "'" + email + "'").join(",")}) and raw_user_meta_data->>'qa_run' = '${runId}';`;
    const cleanupFile = resolve(artifacts, "cleanup.sql");
    await writeFile(cleanupFile, sql);
    try {
      execFileSync(
        "powershell.exe",
        [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          `& npx supabase db query --remote=${projectRef} --file '${cleanupFile.replaceAll("'", "''")}' --yes`,
        ],
        { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8", timeout: 60000 },
      );
      pass("Disposable test users and their private records cleaned up");
    } catch {
      cleaned = false;
      console.error("QA cleanup: exact test-account deletion needs retry.");
    }
  }
  await writeFile(
    resolve(artifacts, "live-report.json"),
    JSON.stringify(
      { runId, passed: !failure, cleanupComplete: cleaned, checks: reports },
      null,
      2,
    ),
  );
  if (!cleaned || failure) process.exitCode = 1;
}
