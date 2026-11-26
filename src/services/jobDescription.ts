export type JobDescriptionParts = { roleText: string; companyText: string };
const headingText = (line: string) =>
  line
    .normalize("NFKC")
    .replace(/^[\s#*•\-–—]+|[\s:*#–—]+$/g, "")
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
function roleHeading(line: string): boolean {
  if (
    /^about\b.{0,70}\b(?:role|position|job|team|you|internship|opportunity)\b/i.test(
      line,
    )
  )
    return true;
  return /^(?:(?:about|overview of) (?:the |this |your )?(?:role|position|job|team)|the (?:role|job|team|ideal candidate)|role(?: overview| summary| description)?|job(?: overview| summary| description| responsibilities)?|position(?: overview| summary| description)?|(?:key |your |core |primary )?responsibilities|(?:desired |minimum |preferred |required )?(?:qualifications|requirements|skills)|what (?:you(?:'ll| will)?|we(?:'re| are)?|makes you)\b.{0,80}|(?:your|the) (?:impact|mission|opportunity|profile)|(?:skills|experience) (?:and|&) .{1,60}|benefits|what we offer|why join.{0,60}|how to apply|hiring process|open problems)$/i.test(
    line,
  );
}
function companyHeading(line: string): boolean {
  if (roleHeading(line)) return false;
  return /^(?:about (?:us|the company|our company)|who (?:we are|are we)|(?:our|the) company|company (?:overview|profile|introduction|description)|our (?:story|mission|vision|impact(?: and growth)?|product lines|culture(?: and values)?|values)|about [\p{L}\p{N}][\p{L}\p{N} &'()./-]{0,70})$/iu.test(
    line,
  );
}
/** Separate explicit employer sections, preserving the original words and order.
 * Unrecognised/ambiguous prose stays with the role rather than being discarded. */
export function splitJobDescription(
  description: string | null,
  companyName: string,
): JobDescriptionParts {
  if (!description?.trim()) return { roleText: "", companyText: "" };
  const lines = description
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .flatMap((line) => {
      const inline = line.match(
        /^\s*(About (?:us|the company|our company)|Who we are)\s*:\s*(\S.*)$/i,
      );
      return inline ? [inline[1]!, inline[2]!] : [line];
    });
  const role: string[] = [],
    company: string[] = [];
  let state: "role" | "company" = "role";
  // Recognise an unlabelled company preface only when a clear role boundary and
  // an explicit company introduction are both present. Never move hiring prose.
  const firstRole = lines.findIndex((line) => roleHeading(headingText(line)));
  if (firstRole > 0) {
    const prefix = lines.slice(0, firstRole).join("\n").trim();
    const escaped = companyName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const introduction = new RegExp(
      `^(?:${escaped}\\s+(?:is|was|helps|builds|provides|enables|offers|powers|creates|connects|operates)\\b|At\\s+${escaped}\\b)`,
      "i",
    );
    if (
      introduction.test(prefix) &&
      !/(?:we(?:'re| are)?|company) (?:looking for|seeking|hiring)|\bseeking\b|\bthis role\b|\bthis position\b/i.test(
        prefix,
      )
    ) {
      state = "company";
    }
  }
  for (const line of lines) {
    const heading = headingText(line);
    if (heading.length <= 100 && roleHeading(heading)) state = "role";
    else if (heading.length <= 100 && companyHeading(heading))
      state = "company";
    (state === "company" ? company : role).push(line);
  }
  const clean = (parts: string[]) =>
    parts
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  return { roleText: clean(role), companyText: clean(company) };
}
