import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { isValidResume, MAX_RESUME_BYTES } from "./onboarding.js";

GlobalWorkerOptions.workerSrc = workerUrl;

export type ResumeEducation = {
  qualification: string;
  institution?: string | undefined;
  year?: string | undefined;
  grade?: string | undefined;
};

export type ResumeExperience = {
  title: string;
  company?: string | undefined;
  dateRange?: string | undefined;
};

export type ResumeSuggestions = {
  candidateName?: string | undefined;
  email?: string | undefined;
  phone?: string | undefined;
  linkedin?: string | undefined;
  github?: string | undefined;
  portfolio?: string | undefined;
  skills: string[];
  education: ResumeEducation[];
  experience: ResumeExperience[];
  targetRoles: string[];
  totalExperienceYears?: number | undefined;
};

export type ResumeParseResult =
  | { status: "success"; pageCount: number; suggestions: ResumeSuggestions; warnings: string[] }
  | { status: "empty"; pageCount: number; warnings: string[] }
  | { status: "error"; pageCount: number; message: string; warnings: string[] };

export type SectionType =
  | "SUMMARY"
  | "SKILLS"
  | "EXPERIENCE"
  | "PROJECTS"
  | "EDUCATION"
  | "CERTIFICATIONS";

export const SKILL_ALIASES: ReadonlyArray<readonly [string, ...string[]]> = [
  // Core Languages
  ["JavaScript", "javascript", "js", "ecmascript"],
  ["TypeScript", "typescript", "ts"],
  ["Python", "python", "py"],
  ["Java", "java", "core java"],
  ["C++", "c++", "cpp"],
  ["C#", "c#", "csharp", ".net", "dotnet"],
  ["Go", "golang", "go programming"],
  ["Rust", "rust"],
  ["Ruby", "ruby", "rails", "ruby on rails"],
  ["PHP", "php"],
  ["Swift", "swift", "swiftui"],
  ["Kotlin", "kotlin"],
  ["SQL", "sql", "pl/sql", "t-sql"],
  ["HTML", "html", "html5"],
  ["CSS", "css", "css3"],
  // Frontend & UI
  ["React", "react", "react.js", "reactjs"],
  ["Next.js", "next.js", "nextjs"],
  ["Vue", "vue", "vue.js", "vuejs"],
  ["Angular", "angular", "angularjs"],
  ["Tailwind", "tailwind", "tailwind css", "tailwindcss"],
  ["Figma", "figma"],
  // Backend & APIs
  ["Node.js", "node.js", "nodejs", "node"],
  ["Express", "express", "express.js", "expressjs"],
  ["Django", "django"],
  ["FastAPI", "fastapi"],
  ["Spring Boot", "spring boot", "springboot", "spring framework"],
  ["GraphQL", "graphql"],
  // Cloud & DevOps
  ["Cloud", "cloud", "aws", "amazon web services", "azure", "gcp", "google cloud"],
  ["Docker", "docker"],
  ["Kubernetes", "kubernetes", "k8s"],
  ["Linux", "linux", "unix", "ubuntu"],
  ["Git", "git", "github", "gitlab"],
  ["CI/CD", "ci/cd", "cicd", "continuous integration", "jenkins", "github actions"],
  ["Terraform", "terraform"],
  // Databases
  ["PostgreSQL", "postgresql", "postgres"],
  ["MySQL", "mysql"],
  ["MongoDB", "mongodb", "mongo"],
  ["Redis", "redis"],
  // AI, Data & Machine Learning
  ["Machine Learning", "machine learning", "ml"],
  ["Deep Learning", "deep learning"],
  ["LLMs", "llm", "llms", "large language model", "large language models"],
  ["RAG", "rag", "retrieval augmented generation", "retrieval-augmented generation"],
  ["MCP", "mcp", "model context protocol"],
  ["PyTorch", "pytorch"],
  ["TensorFlow", "tensorflow"],
  ["Data Analysis", "data analysis", "data analytics", "pandas", "numpy"],
  // Product & Quality
  ["Product Management", "product management", "product strategy", "roadmap"],
  ["QA", "qa", "quality assurance", "cypress", "playwright", "selenium", "jest", "vitest", "unit testing"],
  ["Cybersecurity", "cybersecurity", "infosec", "information security", "penetration testing"],
];

export const CANONICAL_ROLES = [
  "Software Engineer",
  "Frontend Developer",
  "Backend Developer",
  "Full-Stack Developer",
  "Data Analyst",
  "Data Scientist",
  "AI/ML Engineer",
  "Product Designer",
  "Product Manager",
  "Cybersecurity Engineer",
  "DevOps Engineer",
] as const;

const ROLE_MAPPINGS: ReadonlyArray<readonly [RegExp, string]> = [
  [/frontend|front-end|ui developer|react developer|angular developer|vue developer/i, "Frontend Developer"],
  [/backend|back-end|node(?:\.js)? developer|java developer|python developer|django developer|golang developer/i, "Backend Developer"],
  [/full[- ]stack|fullstack/i, "Full-Stack Developer"],
  [/machine learning|ml engineer|ai engineer|deep learning|nlp engineer|computer vision/i, "AI/ML Engineer"],
  [/data scientist/i, "Data Scientist"],
  [/data analyst|business analyst|bi analyst|analytics/i, "Data Analyst"],
  [/devops|site reliability|sre|cloud engineer|platform engineer|infrastructure engineer/i, "DevOps Engineer"],
  [/product manager|associate product manager|technical product manager/i, "Product Manager"],
  [/product designer|ui\/ux|ux designer|user experience designer/i, "Product Designer"],
  [/cybersecurity|security engineer|infosec|penetration tester|security analyst/i, "Cybersecurity Engineer"],
  [/software engineer|software developer|swe|sde|systems engineer|programmer/i, "Software Engineer"],
];

const ROLE_WORDS = /(?:software|frontend|front-end|backend|back-end|full[- ]stack|data|machine learning|ai\/ml|product|devops|cloud|platform|qa|quality assurance|cybersecurity|designer|analyst|scientist|engineer|developer|manager|researcher|architect|consultant|lead|specialist|intern|associate|director|officer|administrator|technician|programmer|instructor|fellow|head)/i;

const SECTION_PATTERNS: ReadonlyArray<readonly [SectionType, RegExp]> = [
  ["SUMMARY", /^(?:professional\s+|executive\s+|career\s+)?(?:summary|profile|about\s+me|objective|career\s+objective)$/i],
  ["SKILLS", /^(?:technical\s+|core\s+|key\s+)?(?:skills|competencies|technologies|tools)(?:\s*(?:&|and|\/)\s*(?:skills|competencies|technologies|tools|frameworks))?$/i],
  ["EXPERIENCE", /^(?:work\s+|professional\s+|employment\s+|career\s+|relevant\s+)?(?:experience|history|employment)$/i],
  ["PROJECTS", /^(?:personal\s+|academic\s+|key\s+|selected\s+)?projects(?:\s+work)?$/i],
  ["EDUCATION", /^(?:academic\s+|educational\s+)?(?:education|background|qualifications|academics)(?:\s+details)?$/i],
  ["CERTIFICATIONS", /^(?:licenses\s*(?:&|and)\s*)?(?:certifications?|certificates?|achievements?|honors?(?:\s*(?:&|and)\s*awards)?|awards?(?:\s*(?:&|and)\s*achievements)?)$/i],
];

const MONTH_NAMES = "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const DATE_PART = `(?:(?:${MONTH_NAMES}[.,]?\\s*|\\d{1,2}\\/)?(?:19|20)\\d{2})`;
const END_PART = `(?:${DATE_PART}|present|current)`;
const DATE_RANGE_REGEX = new RegExp(`(${DATE_PART})\\s*(?:-|–|—|to)\\s*(${END_PART})`, "i");

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesSkillAlias(text: string, alias: string): boolean {
  const hasSymbol = /[+#./-]/.test(alias);
  const escaped = escapeRegExp(alias);
  if (hasSymbol) {
    const regex = new RegExp(`(?:^|[^a-zA-Z0-9_])${escaped}(?:$|[^a-zA-Z0-9_])`, "i");
    return regex.test(text);
  }
  if (alias.toLowerCase() === "go") {
    return /\b(?:golang|go\s+language|go\s+developer|go\s+engineer)\b/i.test(text) || /\bGo\b/.test(text);
  }
  return new RegExp(`\\b${escaped}\\b`, "i").test(text);
}

function findFirstUrl(text: string, host: string): string | undefined {
  const match = text.match(new RegExp(`(?:https?:\\/\\/)?(?:www\\.)?${escapeRegExp(host)}\\/[^\\s)>]+`, "i"));
  return match?.[0]?.replace(/[),.;]+$/, "");
}

function parseEmail(text: string): string | undefined {
  const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match?.[0]?.replace(/[),.;]+$/, "");
}

function parsePhone(text: string): string | undefined {
  const candidateMatches = text.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,5}\)?[-.\s]?\d{3,5}[-.\s]?\d{3,5}/g);
  if (candidateMatches) {
    for (const match of candidateMatches) {
      const cleanMatch = clean(match);
      if (DATE_RANGE_REGEX.test(cleanMatch)) continue;
      const digits = cleanMatch.replace(/\D/g, "");
      if (digits.length >= 10 && digits.length <= 15) {
        if (!/^(?:19|20)\d{2}(?:19|20)\d{2}$/.test(digits)) return cleanMatch;
      }
    }
  }

  const fallbackMatches = text.match(/(?:\+?\d[\d .()\-]{8,}\d)/g);
  if (fallbackMatches) {
    for (const match of fallbackMatches) {
      const cleanMatch = clean(match);
      if (DATE_RANGE_REGEX.test(cleanMatch)) continue;
      const digits = cleanMatch.replace(/\D/g, "");
      if (digits.length >= 10 && digits.length <= 15) {
        if (!/^(?:19|20)\d{2}(?:19|20)\d{2}$/.test(digits)) return cleanMatch;
      }
    }
  }

  return undefined;
}

export function detectSectionHeading(line: string): SectionType | null {
  const normalized = line
    .replace(/^[#*•\-\d.\s]+/, "")
    .replace(/[:\s]+$/, "")
    .trim();

  if (!normalized || normalized.length > 35) return null;
  if (/@|http|\.com|\+?\d{4,}/i.test(normalized)) return null;
  const wordCount = normalized.split(/\s+/).length;
  if (wordCount > 4) return null;

  for (const [sectionType, regex] of SECTION_PATTERNS) {
    if (regex.test(normalized)) {
      return sectionType;
    }
  }
  return null;
}

export function splitIntoSections(lines: string[]): Record<SectionType | "HEADER", string[]> {
  const sections: Record<SectionType | "HEADER", string[]> = {
    HEADER: [],
    SUMMARY: [],
    SKILLS: [],
    EXPERIENCE: [],
    PROJECTS: [],
    EDUCATION: [],
    CERTIFICATIONS: [],
  };

  let currentSection: SectionType | "HEADER" = "HEADER";

  for (const rawLine of lines) {
    const trimmed = clean(rawLine);
    if (!trimmed) continue;

    const heading = detectSectionHeading(trimmed);
    if (heading) {
      currentSection = heading;
      continue;
    }

    sections[currentSection].push(trimmed);
  }

  return sections;
}

function parseCandidateName(headerLines: string[]): string | undefined {
  for (const rawLine of headerLines.slice(0, 8)) {
    let value = clean(rawLine);
    if (!value) continue;
    if (/@|http|\.com|www|\.org|\.dev|\.me|\.in|\+?\d{4,}/i.test(value)) continue;
    if (/\b(?:resume|curriculum vitae|cv|portfolio|profile|contact|email|phone|linkedin|github|address|location)\b/i.test(value)) {
      continue;
    }

    if (/[|•–—,]/.test(value)) {
      const firstSegment = clean(value.split(/[|•–—,]/)[0] ?? "");
      if (
        firstSegment &&
        !ROLE_WORDS.test(firstSegment) &&
        !/@|http|\.com|\d/.test(firstSegment)
      ) {
        value = firstSegment;
      }
    }

    if (ROLE_WORDS.test(value)) continue;

    const parts = value.split(/\s+/);
    if (
      parts.length >= 2 &&
      parts.length <= 4 &&
      /^[A-Za-z][A-Za-z .'-]+$/.test(value) &&
      value.length >= 3 &&
      value.length <= 40
    ) {
      return value;
    }
  }
  return undefined;
}

function parseEducationSection(educationLines: string[]): ResumeEducation[] {
  if (!educationLines || educationLines.length === 0) return [];
  const result: ResumeEducation[] = [];

  const DEGREE_REGEX = /\b(?:B\.?Tech|M\.?Tech|B\.?E\.?|M\.?E\.?|B\.?Sc|M\.?Sc|BCA|MCA|BBA|MBA|Ph\.?D|Bachelor(?:'s)?(?:\s+of\s+[A-Za-z\s]+)?|Master(?:'s)?(?:\s+of\s+[A-Za-z\s]+)?|Diploma|Associate(?:'s)?|High\s+School|Senior\s+Secondary|Secondary\s+School)\b/i;
  const INST_KEYWORDS = /university|college|institute|school|academy|technology|campus|bits|iit|nit|iiit|vit/i;
  const GRADE_REGEX = /\b(?:CGPA|GPA|Percentage|Score|Grade)?\s*:?\s*(?:\d(?:\.\d{1,2})?\s*\/\s*(?:10|4)|\d{1,2}(?:\.\d{1,2})?%|\b\d\.\d{1,2}\s*(?:CGPA|GPA)\b)/i;

  let index = 0;
  while (index < educationLines.length) {
    const line = educationLines[index] ?? "";
    const degreeMatch = line.match(DEGREE_REGEX);

    if (degreeMatch) {
      let qualification = line;
      let institution: string | undefined;
      let year: string | undefined;
      let grade: string | undefined;

      // Check for dates on this line
      const dateMatch = line.match(DATE_RANGE_REGEX) || line.match(/\b(?:19|20)\d{2}\b/);
      if (dateMatch) {
        year = dateMatch[0];
      }

      // Check for grade on this line
      const gradeMatch = line.match(GRADE_REGEX);
      if (gradeMatch) {
        grade = gradeMatch[0].trim();
      }

      // Check if line contains institution separated by delimiter
      const parts = line.split(/[|–—,•]\s*/);
      if (parts.length > 1) {
        const foundDegreePart = parts.find((p) => DEGREE_REGEX.test(p));
        const foundInstPart = parts.find((p) => INST_KEYWORDS.test(p));
        if (foundDegreePart) qualification = clean(foundDegreePart);
        if (foundInstPart) institution = clean(foundInstPart);
      }

      // Scan up to 3 subsequent lines for missing details (institution, year, grade)
      let forwardIndex = index + 1;
      while (forwardIndex < educationLines.length && forwardIndex <= index + 3) {
        const fLine = educationLines[forwardIndex] ?? "";
        if (DEGREE_REGEX.test(fLine)) {
          break; // Next degree entry begins
        }
        if (!institution && INST_KEYWORDS.test(fLine) && fLine.length < 90) {
          institution = clean(fLine);
          forwardIndex += 1;
          continue;
        }
        let consumed = false;
        if (!year) {
          const nextDate = fLine.match(DATE_RANGE_REGEX) || fLine.match(/\b(?:19|20)\d{2}\b/);
          if (nextDate) {
            year = nextDate[0];
            consumed = true;
          }
        }
        if (!grade) {
          const nextGrade = fLine.match(GRADE_REGEX);
          if (nextGrade) {
            grade = nextGrade[0].trim();
            consumed = true;
          }
        }
        if (consumed) {
          forwardIndex += 1;
        } else {
          break;
        }
      }
      index = forwardIndex - 1;

      result.push({
        qualification: clean(qualification),
        ...(institution ? { institution: clean(institution) } : {}),
        ...(year ? { year: clean(year) } : {}),
        ...(grade ? { grade: clean(grade) } : {}),
      });
    } else if (INST_KEYWORDS.test(line)) {
      // Line is an institution, check next lines for degree
      const institution = clean(line);
      let forwardIndex = index + 1;
      let qualification: string | undefined;
      let year: string | undefined;
      let grade: string | undefined;

      while (forwardIndex < educationLines.length && forwardIndex <= index + 3) {
        const fLine = educationLines[forwardIndex] ?? "";
        if (!qualification && DEGREE_REGEX.test(fLine)) {
          qualification = clean(fLine);
          const dateMatch = fLine.match(DATE_RANGE_REGEX) || fLine.match(/\b(?:19|20)\d{2}\b/);
          if (dateMatch) year = dateMatch[0];
          const gradeMatch = fLine.match(GRADE_REGEX);
          if (gradeMatch) grade = gradeMatch[0].trim();
          forwardIndex += 1;
          continue;
        }
        let consumed = false;
        if (!year) {
          const nextDate = fLine.match(DATE_RANGE_REGEX) || fLine.match(/\b(?:19|20)\d{2}\b/);
          if (nextDate) {
            year = nextDate[0];
            consumed = true;
          }
        }
        if (!grade) {
          const nextGrade = fLine.match(GRADE_REGEX);
          if (nextGrade) {
            grade = nextGrade[0].trim();
            consumed = true;
          }
        }
        if (consumed) {
          forwardIndex += 1;
        } else {
          break;
        }
      }

      if (qualification) {
        index = forwardIndex - 1;
        result.push({
          qualification,
          institution,
          ...(year ? { year: clean(year) } : {}),
          ...(grade ? { grade: clean(grade) } : {}),
        });
      }
    }

    index += 1;
  }

  return result.slice(0, 5);
}

function parseExperienceSection(experienceLines: string[]): ResumeExperience[] {
  if (!experienceLines || experienceLines.length === 0) return [];
  const result: ResumeExperience[] = [];

  experienceLines.forEach((line, index) => {
    const dateMatch = line.match(DATE_RANGE_REGEX);
    if (!dateMatch) return;

    const dateRange = clean(dateMatch[0]);
    let title: string | undefined;
    let company: string | undefined;

    // Check if title or company is on the same line
    const remainingLine = clean(
      line.replace(dateMatch[0], "").replace(/^[(\[\s|,–—-]+|[)\]\s|,–—-]+$/g, "")
    );

    if (remainingLine) {
      const parts = remainingLine.split(/\s*(?:\||–|—|,|•|\bat\b)\s*/i);
      const rolePart = parts.find((p) => p && ROLE_WORDS.test(p) && p.length < 80);
      const companyPart = parts.find(
        (p) => p && p !== rolePart && p.length < 80 && !ROLE_WORDS.test(p)
      );

      if (rolePart) title = clean(rolePart);
      if (companyPart) company = clean(companyPart);
    }

    // Look at previous and next lines if title or company is still needed
    if (!title || !company) {
      const prev1 = clean(experienceLines[index - 1] ?? "");
      const prev2 = clean(experienceLines[index - 2] ?? "");
      const next1 = clean(experienceLines[index + 1] ?? "");
      const next2 = clean(experienceLines[index + 2] ?? "");

      const candidateLines = [prev1, prev2, next1, next2].filter(
        (l) => l && !l.startsWith("•") && !l.startsWith("-") && !l.startsWith("*") && l.length < 80
      );

      if (!title) {
        const foundTitle = candidateLines.find((l) => ROLE_WORDS.test(l));
        if (foundTitle) {
          if (/\s+at\s+/i.test(foundTitle)) {
            const atParts = foundTitle.split(/\s+at\s+/i);
            title = clean(atParts[0]!);
            if (!company && atParts[1]) company = clean(atParts[1]);
          } else {
            title = foundTitle;
          }
        }
      }

      if (!company) {
        const foundCompany = candidateLines.find(
          (l) => l !== title && !ROLE_WORDS.test(l) && !DATE_RANGE_REGEX.test(l)
        );
        if (foundCompany) company = foundCompany;
      }
    }

    if (title) {
      result.push({
        title,
        ...(company ? { company } : {}),
        dateRange,
      });
    }
  });

  return result.slice(0, 10);
}

function yearsFromRanges(experience: ResumeExperience[], now = new Date()): number | undefined {
  const intervals: Array<[number, number]> = [];
  for (const item of experience) {
    if (!item.dateRange) continue;
    const match = item.dateRange.match(DATE_RANGE_REGEX);
    if (!match) continue;

    const parsePart = (value: string): number | undefined => {
      const yearMatch = value.match(/(\d{4})/);
      if (!yearMatch?.[1]) return undefined;
      const monthMatch = value.match(/jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i)?.[0];
      const monthIndex = monthMatch
        ? ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(
            monthMatch.slice(0, 3).toLowerCase()
          )
        : 0;
      return Number(yearMatch[1]) * 12 + Math.max(monthIndex, 0);
    };

    const start = parsePart(match[1] ?? "");
    const end = /present|current/i.test(match[2] ?? "")
      ? now.getFullYear() * 12 + now.getMonth()
      : parsePart(match[2] ?? "");

    if (start !== undefined && end !== undefined && end >= start) {
      intervals.push([start, end]);
    }
  }

  if (!intervals.length) return undefined;
  intervals.sort((a, b) => a[0] - b[0]);

  let totalMonths = 0;
  let currentStart = intervals[0]![0];
  let currentEnd = intervals[0]![1];

  for (const [nextStart, nextEnd] of intervals.slice(1)) {
    if (nextStart <= currentEnd) {
      currentEnd = Math.max(currentEnd, nextEnd);
    } else {
      totalMonths += currentEnd - currentStart;
      currentStart = nextStart;
      currentEnd = nextEnd;
    }
  }
  totalMonths += currentEnd - currentStart;

  return Math.round((totalMonths / 12) * 10) / 10;
}

function mapExperienceToTargetRoles(experience: ResumeExperience[]): string[] {
  const suggested: string[] = [];
  for (const exp of experience) {
    const title = exp.title;
    for (const [pattern, canonicalRole] of ROLE_MAPPINGS) {
      if (pattern.test(title)) {
        if (!suggested.includes(canonicalRole)) {
          suggested.push(canonicalRole);
        }
      }
    }
  }
  return suggested.slice(0, 3);
}

export function parseResumeText(text: string, now = new Date()): ResumeSuggestions {
  const rawLines = text.split(/\r?\n/).map(clean).filter(Boolean);
  const sections = splitIntoSections(rawLines);

  // 1. Candidate Name (Header section only)
  const candidateName = parseCandidateName(sections.HEADER);

  // 2. Email & Phone (From text)
  const email = parseEmail(text);
  const phone = parsePhone(text);

  // 3. URLs
  const linkedin = findFirstUrl(text, "linkedin.com/in");
  const github = findFirstUrl(text, "github.com");
  const urls = [...text.matchAll(/(?:https?:\/\/|www\.)[^\s)>]+/gi)].map((m) =>
    m[0].replace(/[),.;]+$/, "")
  );
  const nonPortfolioDomains = /linkedin\.com|github\.com|google\.com|twitter\.com|x\.com|facebook\.com|instagram\.com|medium\.com|youtube\.com|npmjs\.com|coursera\.org|udemy\.com|stackoverflow\.com/i;
  const portfolio = urls.find((url) => !nonPortfolioDomains.test(url));

  // 4. Skills (Prioritized from SKILLS section; conservative fallback to full text)
  const skillsLines =
    sections.SKILLS.length > 0
      ? sections.SKILLS
      : rawLines.filter((l) => /^(?:technical\s+|core\s+)?skills\s*:/i.test(l));
  const skillsSearchText = skillsLines.length > 0 ? skillsLines.join(" ") : text;
  const skills = SKILL_ALIASES.filter(([, ...aliases]) =>
    aliases.some((alias) => matchesSkillAlias(skillsSearchText, alias))
  ).map(([canonical]) => canonical);

  // 5. Experience (Strictly from EXPERIENCE section)
  const experience = parseExperienceSection(sections.EXPERIENCE);

  // 6. Total Experience (Calculated strictly from experience entries)
  const totalExperienceYears = yearsFromRanges(experience, now);

  // 7. Target Roles (Mapped strictly from experience titles)
  const targetRoles = mapExperienceToTargetRoles(experience);

  // 8. Education (Strictly from EDUCATION section)
  const education = parseEducationSection(sections.EDUCATION);

  return {
    ...(candidateName ? { candidateName } : {}),
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
    ...(linkedin ? { linkedin } : {}),
    ...(github ? { github } : {}),
    ...(portfolio ? { portfolio } : {}),
    skills,
    education,
    experience,
    targetRoles,
    ...(totalExperienceYears !== undefined ? { totalExperienceYears } : {}),
  };
}

export function extractTextFromPage(content: { items: unknown[] }): string {
  const lines: string[] = [];
  let currentLine = "";
  let lastY: number | null = null;

  for (const rawItem of content.items) {
    if (!rawItem || typeof rawItem !== "object" || !("str" in rawItem)) continue;
    const item = rawItem as { str: string; transform?: number[]; hasEOL?: boolean };
    const str = item.str;
    if (!str && !item.hasEOL) continue;

    const transformY = Array.isArray(item.transform) ? item.transform[5] : undefined;
    const y = typeof transformY === "number" ? Math.round(transformY * 10) / 10 : null;
    const isNewLine = item.hasEOL || (lastY !== null && y !== null && Math.abs(y - lastY) > 3.5);

    if (isNewLine && currentLine.trim()) {
      lines.push(currentLine.trim());
      currentLine = "";
    }

    if (str) {
      const needsSpace = currentLine && !currentLine.endsWith(" ") && !str.startsWith(" ");
      currentLine += (needsSpace ? " " : "") + str;
    }

    if (y !== null) {
      lastY = y;
    }
  }

  if (currentLine.trim()) {
    lines.push(currentLine.trim());
  }

  return lines.join("\n");
}

export async function extractResume(file: File): Promise<ResumeParseResult> {
  if (!isValidResume(file)) {
    return {
      status: "error",
      pageCount: 0,
      message: file.size > MAX_RESUME_BYTES ? "Your resume must be 5 MB or smaller." : "Please choose a PDF resume.",
      warnings: [],
    };
  }
  let loadingTask: ReturnType<typeof getDocument> | undefined;
  let pdf: PDFDocumentProxy | undefined;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    loadingTask = getDocument({ data: bytes, disableAutoFetch: true, disableStream: true });
    pdf = await loadingTask.promise;
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      try {
        const content = await page.getTextContent();
        const pageText = extractTextFromPage(content);
        if (pageText) pages.push(pageText);
      } finally {
        page.cleanup();
      }
    }
    const text = pages.join("\n").trim();
    if (!text) {
      return {
        status: "empty",
        pageCount: pdf.numPages,
        warnings: [
          "This PDF has no selectable text. A scanned or image-only PDF needs manual entry in the next steps.",
        ],
      };
    }
    return {
      status: "success",
      pageCount: pdf.numPages,
      suggestions: parseResumeText(text),
      warnings: ["These are suggestions from selectable text. Review every field before continuing."],
    };
  } catch (err: unknown) {
    const errorObj = err as { name?: string; message?: string } | undefined;
    if (errorObj?.name === "PasswordException" || /password/i.test(errorObj?.message ?? "")) {
      return {
        status: "error",
        pageCount: 0,
        message: "This PDF is password-protected. Please upload an unlocked PDF.",
        warnings: [],
      };
    }
    return {
      status: "error",
      pageCount: 0,
      message: "We couldn't read that PDF. Try an unlocked PDF with selectable text.",
      warnings: [],
    };
  } finally {
    try {
      await pdf?.cleanup();
    } catch {
      /* best effort */
    }
    try {
      await pdf?.destroy();
    } catch {
      /* best effort */
    }
    try {
      await loadingTask?.destroy();
    } catch {
      /* best effort */
    }
  }
}

export function splitCandidateName(value: string | undefined): { firstName: string; lastName: string } {
  const parts = value?.trim().split(/\s+/).filter(Boolean) ?? [];
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}
