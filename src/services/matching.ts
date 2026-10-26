import type { CareerProfile, MatchResult } from '../domain/types.js';

export interface MatchCandidate { id: string; entityType: 'COMPANY' | 'JOB'; skills?: string[]; city?: string | null; workMode?: string | null; industry?: string | null; }
export function explainMatches(profile: CareerProfile, candidates: MatchCandidate[]): MatchResult[] {
  const wantedSkills = new Set(profile.skills.map((skill) => skill.toLowerCase()));
  return candidates.map((candidate) => {
    const reasons = [] as MatchResult['reasons'];
    const matches = (candidate.skills ?? []).filter((skill) => wantedSkills.has(skill.toLowerCase()));
    if (matches.length) reasons.push({ type: 'SKILL', text: `Matches skills: ${matches.join(', ')}`, evidence: matches.join(', ') });
    if (candidate.city && profile.preferredCities?.some((city) => city.toLowerCase() === candidate.city?.toLowerCase())) reasons.push({ type: 'LOCATION', text: `Available in ${candidate.city}`, evidence: candidate.city });
    if (candidate.workMode && profile.preferredWorkModes?.some((mode) => mode.toLowerCase() === candidate.workMode?.toLowerCase())) reasons.push({ type: 'WORK_MODE', text: `Supports ${candidate.workMode}`, evidence: candidate.workMode });
    return { entityType: candidate.entityType, entityId: candidate.id, reasons };
  });
}
