const normalize = (text: string) =>
  text.replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim().toLowerCase();
/** Remove presentation headings already supplied by the page, not the source duties. */
export function cleanRoleDescription(text: string, title: string): string {
  const generic =
    /^(?:about (?:the |this |your )?(?:role|team|job|position)|the role|role (?:overview|summary|description)|job (?:overview|summary|description)|position (?:overview|summary|description))[:.\s]*$/i;
  const lines = text
    .split("\n")
    .filter(
      (line) =>
        !generic.test(line.trim()) && normalize(line) !== normalize(title),
    );
  const result: string[] = [];
  let previous = "";
  for (const line of lines) {
    const key = normalize(line);
    if (key && key === previous) continue;
    result.push(line);
    if (key) previous = key;
  }
  const seen = new Set<string>();
  return result
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .split(/\n\s*\n/)
    .filter((block) => {
      const key = normalize(block);
      if (key.length < 60) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join("\n\n")
    .trim();
}
type RequirementSource = {
  experience_requirement?: string | null;
  education_requirement?: string | null;
  graduation_requirement?: string | null;
  marks_requirement?: string | null;
  skills?: readonly string[];
};
const given = (value: string) =>
  !!value.trim() &&
  !/^(?:not stated|not specified|not provided|unknown|n\/?a|none|not disclosed|[-—])\.?$/i.test(
    value.trim(),
  );
export function statedRequirements(job: RequirementSource): [string, string][] {
  const fields: [string, string | null | undefined][] = [
    ["Experience", job.experience_requirement],
    ["Degree", job.education_requirement],
    ["Graduation year", job.graduation_requirement],
    ["Marks", job.marks_requirement],
    [
      "Skills",
      [...new Set((job.skills ?? []).map((s) => s.trim()).filter(given))].join(
        ", ",
      ),
    ],
  ];
  return fields
    .filter(
      (row): row is [string, string] =>
        typeof row[1] === "string" && given(row[1]),
    )
    .map(([label, value]) => [label, value.trim()]);
}
