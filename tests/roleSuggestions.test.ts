import { describe, it, expect } from 'vitest';
import { suggestRelatedRoles } from '../src/services/roleSuggestions.js';
import { parseResumeText } from '../src/services/resumeParser.js';
describe('expanded roles', () => {
 it.each(['QA Engineer','Business Analyst','Accountant','Recruiter','Data Engineer','Technical Support Engineer'])('recognizes %s without collapsing it into software or data analyst', title => {
 const result = parseResumeText('Asha Rao\nExperience\n' + title + '\nAcme Labs\nJan 2024 - Dec 2024');
 expect(result.targetRoles).toContain(title);
 });
 it('suggests adjacent roles without modifying or repeating selections', () => {
 const selected = ['AI/ML Engineer']; const result = suggestRelatedRoles(selected);
 expect(result).toContain('Data Scientist'); expect(result).not.toContain('AI/ML Engineer'); expect(selected).toEqual(['AI/ML Engineer']); expect(result.length).toBeLessThanOrEqual(5);
 });
 it('does not invent recommendations for an unknown title', () => expect(suggestRelatedRoles(['Unknown title'])).toEqual([]));
});