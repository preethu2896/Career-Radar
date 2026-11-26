import { describe, it, expect } from 'vitest';
import { EMPTY_JOB_FILTERS, filterOpenings } from '../src/services/discovery.js';
import type { Opportunity } from '../src/services/candidateWorkspace.js';
const now = Date.parse('2026-11-20T12:00:00Z');
const job: Opportunity = { id:'a', company_name:'Alpha', title:'Data Analyst', location:'Bengaluru', work_mode:'Hybrid', experience_requirement:'Freshers welcome', education_requirement:null, graduation_requirement:null, marks_requirement:null, salary:null, description:null, application_instructions:null, skills:['SQL'], source_url:'https://example.com/jobs', application_url:null, contact_email:null, contact_source_url:null, source_kind:'OFFICIAL', status:'OPEN', published_at:'2026-11-20T10:00:00Z', first_seen_at:'2026-11-20T10:00:00Z', last_checked_at:'2026-11-20T11:00:00Z' };
describe('public discovery filters', () => {
  it('excludes closed, stale, future-checked and unsourced records', () => {
    const rows=[job,{...job,id:'closed',status:'CLOSED' as const},{...job,id:'old',last_checked_at:'2026-10-01T00:00:00Z'},{...job,id:'future',last_checked_at:'2026-12-01T00:00:00Z'},{...job,id:'unsafe',source_url:'javascript:alert(1)'}];
    expect(filterOpenings(rows,EMPTY_JOB_FILTERS,now).map(row=>row.id)).toEqual(['a']);
  });
  it('combines role/skill search, workplace, city and explicit fresher eligibility', () => {
    const rows=[job,{...job,id:'other',experience_requirement:'Experienced candidates only'}];
    expect(filterOpenings(rows,{...EMPTY_JOB_FILTERS,query:' sql ',location:'beng',workMode:'Hybrid',experience:'freshers'},now).map(row=>row.id)).toEqual(['a']);
  });
  it('does not confuse discovery date with the employer posting date', () => {
    expect(filterOpenings([{...job,published_at:null}],{...EMPTY_JOB_FILTERS,posted:'1'},now)).toEqual([]);
    expect(filterOpenings([job],{...EMPTY_JOB_FILTERS,posted:'1'},now)).toHaveLength(1);
  });
  it('does not classify missing experience as fresher eligibility', () => {
    expect(filterOpenings([{...job,experience_requirement:null}],{...EMPTY_JOB_FILTERS,experience:'freshers'},now)).toEqual([]);
  });
  it('finds internships by explicit title and orders by company name', () => {
    const rows=[{...job,id:'b',company_name:'Zulu',title:'Data Internship'},{...job,id:'c',company_name:'Beta',title:'Data Intern'},job];
    expect(filterOpenings(rows,{...EMPTY_JOB_FILTERS,experience:'internship',sort:'company'},now).map(row=>row.id)).toEqual(['c','b']);
  });
});

it('finds source-labelled internships even when the title does not say intern',()=>{expect(filterOpenings([{...job,title:'Software Engineer',employment_type:'Intern'}],{...EMPTY_JOB_FILTERS,experience:'internship'},now)).toHaveLength(1);});