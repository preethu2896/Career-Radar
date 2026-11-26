// Keep the credential and its numeric result separate, including older drafts.
export const EDUCATION_GRADE_PATTERN =
  /(?:\b(?:CGPA|GPA|Percentage|Marks|Score|Grade)\s*:?\s*\d+(?:\.\d+)?(?:\s*\/\s*(?:100|10|4)\b)?\s*%?|\b\d+(?:\.\d+)?\s*\/\s*(?:100|10|4)\b|\b\d+(?:\.\d+)?\s*(?:%|\b(?:CGPA|GPA)\b))/i;

export function numericEducationScore(value: string): string {
  const match = value
    .trim()
    .match(
      /^(?:(?:CGPA|GPA|Percentage|Marks|Score|Grade)\s*:?\s*)?(\d+(?:\.\d+)?)\s*(?:\/\s*(?:100|10|4))?\s*(?:%|CGPA|GPA|percent(?:age)?)?$/i,
    );
  return match?.[1] ?? "";
}
export function qualificationWithoutScore(value: string): string {
  return value
    .replace(new RegExp(EDUCATION_GRADE_PATTERN.source, "gi"), "")
    .replace(/\s+/g, " ")
    .replace(/\s*[|,;:–—-]+\s*$/, "")
    .trim();
}
export function scoreFromQualification(value: string): string {
  return numericEducationScore(value.match(EDUCATION_GRADE_PATTERN)?.[0] ?? "");
}

const MONTH =
  "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
export function graduationYearFromEducation(value: string): string {
  const text = value.replace(
    /\b(?:est(?:ablished|d)?\.?|founded|since)\s*[:.(]?\s*(?:19|20)\d{2}\b/gi,
    "",
  );
  const explicit = text.match(
    new RegExp(
      `\\b(?:expected\\s+(?:graduation|completion)(?:\\s+(?:year|date))?|graduat(?:ion|ing|ed)(?:\\s+(?:year|date|in))?|(?:year\\s+of\\s+)?(?:passing|completion)|class\\s+of|batch(?:\\s+of)?)\\s*[:\\-]?\\s*(?:${MONTH}[.,]?\\s*)?((?:19|20|21)\\d{2})\\b`,
      "i",
    ),
  );
  if (explicit) return validYear(explicit[1]!);
  if (/\b(?:admitted|admission|enrolled|started|start year)\b/i.test(text))
    return "";
  const range = text.match(
    new RegExp(
      `\\b((?:19|20|21)\\d{2})\\s*(?:-|–|—|to|/)\\s*(?:${MONTH}[.,]?\\s*)?((?:19|20|21)\\d{2}|\\d{2})(?!\\d)`,
      "i",
    ),
  );
  if (range) {
    const start = +range[1]!;
    let end = +range[2]!;
    if (range[2]!.length === 2) {
      end = Math.floor(start / 100) * 100 + end;
      if (end < start) end += 100;
    }
    return end >= start && end - start <= 30 ? validYear(String(end)) : "";
  }
  if (/\b(?:present|current|ongoing|pursuing|in progress)\b/i.test(text))
    return "";
  const years = [...text.matchAll(/\b(?:19|20|21)\d{2}\b/g)].map(
    (match) => match[0],
  );
  if (years.length === 1) return validYear(years[0]!);
  if (
    years.length === 2 &&
    +years[1]! >= +years[0]! &&
    +years[1]! - +years[0]! <= 15
  )
    return validYear(years[1]!);
  return "";
}
function validYear(year: string): string {
  return +year >= 1950 && +year <= 2100 ? year : "";
}

type EducationEntry = {
  qualification: string;
  year?: string | undefined;
  grade?: string | undefined;
};
export function preferredEducation<T extends EducationEntry>(
  entries: T[],
): T | undefined {
  const rank = (value: string) =>
    /\b(?:Ph\.?D|Doctor)/i.test(value)
      ? 5
      : /\b(?:Master|M\.?Tech|M\.?Sc|M\.?Com|MCA|MBA|M\.?E\.?|M\.?Ed|LLM|MSW)\b/i.test(
            value,
          )
        ? 4
        : /\b(?:Bachelor|B\.?Tech|B\.?Sc|B\.?Com|BCA|BBA|B\.?E\.?|B\.?Ed|B\.?Des|MBBS|BDS|LLB|BSW)\b/i.test(
              value,
            )
          ? 3
          : /\b(?:Diploma|Associate|ITI)/i.test(value)
            ? 2
            : 1;
  return [...entries].sort(
    (a, b) =>
      rank(b.qualification) - rank(a.qualification) ||
      +(graduationYearFromEducation(b.year ?? "") || 0) -
        +(graduationYearFromEducation(a.year ?? "") || 0),
  )[0];
}
export function fillMissingEducation<
  T extends {
    educationDegree: string;
    graduationYear: string;
    educationScore: string;
  },
>(draft: T, entries: EducationEntry[]): T {
  const key = (value: string) =>
    qualificationWithoutScore(value)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  const current = key(draft.educationDegree);
  const matches = current
    ? entries.filter((entry) => {
        const candidate = key(entry.qualification);
        return (
          candidate === current ||
          candidate.includes(current) ||
          current.includes(candidate)
        );
      })
    : entries;
  const education = preferredEducation(matches);
  if (!education) return draft;
  return {
    ...draft,
    educationDegree:
      draft.educationDegree ||
      qualificationWithoutScore(education.qualification),
    graduationYear:
      draft.graduationYear || graduationYearFromEducation(education.year ?? ""),
    educationScore:
      draft.educationScore || numericEducationScore(education.grade ?? ""),
  };
}
