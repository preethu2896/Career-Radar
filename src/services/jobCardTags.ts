import type { Opportunity } from './candidateWorkspace.js';

// Cards show structured facts, never an excerpt from the job description.
export function jobCardTags(job: Pick<Opportunity, 'work_mode' | 'employment_type' | 'experience_requirement' | 'skills' | 'salary'>): string[] {
  const tags: string[] = [];
  const workplace = job.work_mode?.trim().toLowerCase().replace(/[\s-]/g, '');
  const workplaces: Record<string, string> = { onsite: 'Onsite', remote: 'Remote', hybrid: 'Hybrid' };
  if (workplace && workplaces[workplace]) tags.push(workplaces[workplace]);
  const employment = job.employment_type?.trim();
  if (employment && /^(?:full[ -]?time|part[ -]?time|contract|temporary|intern(?:ship)?|apprenticeship|freelance)$/i.test(employment)) {
    tags.push(/^intern/i.test(employment) ? 'Internship' : employment);
  }
  const experience = job.experience_requirement?.trim();
  // Reject sentences: they can describe the founders rather than the candidate.
  if (experience && /^(?:freshers?(?: welcome| accepted)?|entry[ -]level|no experience required|(?:minimum\s+|at least\s+)?\d{1,2}(?:\s*[-–]\s*\d{1,2})?\+?\s*(?:years?|yrs?|months?)(?:\s+(?:of\s+)?(?:relevant\s+)?experience)?)[.!]?$/i.test(experience)) {
    tags.push(experience.replace(/[.!]$/, ''));
  }
  for (const raw of job.skills ?? []) {
    const skill = raw.trim();
    if (skill && skill.length <= 32 && skill.split(/\s+/).length <= 4 && !/[•\n\r:;!?]/.test(skill) && !/\b(?:years?|experience|required|minimum)\b/i.test(skill)) tags.push(skill);
  }
  const salary = job.salary?.trim();
  if (salary && salary.length <= 32 && /\d/.test(salary) && !/[•\n\r]/.test(salary)) tags.push(salary);
  return [...new Map(tags.map(tag => [tag.toLowerCase(), tag])).values()].slice(0, 5);
}
