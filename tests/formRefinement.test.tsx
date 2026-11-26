import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RolePicker } from "../src/ui/SetupSections.js";
import {
  friendlyAuthError,
  passwordPolicyError,
} from "../src/services/auth.js";
it("reports the missing password rule in one specific error", () => {
  expect(passwordPolicyError("Aa1!")).toBe("Use at least 8 characters.");
  expect(passwordPolicyError("lowercase1!")).toBe(
    "Add at least one uppercase letter.",
  );
  expect(passwordPolicyError("UPPERCASE1!")).toBe(
    "Add at least one lowercase letter.",
  );
  expect(passwordPolicyError("Upperlower!")).toBe("Add at least one number.");
  expect(passwordPolicyError("Upperlower123")).toBe(
    "Add at least one special character.",
  );
  expect(passwordPolicyError("Upperlower123!")).toBeNull();
  expect(
    friendlyAuthError(
      new Error(
        "PASSWORD_DOES_NOT_MEET_REQUIREMENTS: Add at least one number.",
      ),
    ),
  ).toBe("Add at least one number.");
});
it("uses an accessible role search without the native datalist popup", () => {
  const html = renderToStaticMarkup(
    <RolePicker
      roles={["Data Analyst"]}
      onAdd={() => {}}
      onRemove={() => {}}
    />,
  );
  expect(html).toContain('role="combobox"');
  expect(html).toContain('aria-expanded="false"');
  expect(html).toContain("Remove Data Analyst");
  expect(html).not.toContain("<datalist");
  expect(html).not.toContain(" list=");
});
it("disables role search once three choices are selected", () => {
  const html = renderToStaticMarkup(
    <RolePicker
      roles={["Data Analyst", "Business Analyst", "Software Engineer"]}
      onAdd={() => {}}
      onRemove={() => {}}
    />,
  );
  expect(html).toMatch(/role="combobox"[^>]*disabled/);
  expect(html).toContain("Remove one to add another");
});
