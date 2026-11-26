import {describe,it,expect} from 'vitest';
import {jobCardTags} from '../src/services/jobCardTags.js';
const base={work_mode:null,employment_type:null,experience_requirement:null,skills:[],salary:null};
describe('compact job-card facts',()=>{
  it('omits company biographies and prose requirements without changing the source',()=>{
    for(const text of ['scientists and IIT Bombay alumni with over 20 years of experience in designing, • Minimum 10 years of relevant experience in RCC and structural steel','• Minimum 10 years of relevant experience in pressure vessels, cryogenic systems,']){
      const job={...base,experience_requirement:text};
      expect(jobCardTags(job)).toEqual([]);
      expect(job.experience_requirement).toBe(text);
    }
  });
  it('shows only explicit compact facts, deduplicates skills and limits the tags',()=>{
    expect(jobCardTags({...base,work_mode:'On-site',employment_type:'Intern',experience_requirement:'0–2 years',skills:['SQL','sql','Python','React','AWS']})).toEqual(['Onsite','Internship','0–2 years','sql','Python']);
  });
  it('does not invent unknown workplace or experience labels',()=>{
    expect(jobCardTags({...base,work_mode:'Not stated',skills:['SQL','Minimum 10 years experience','A paragraph describing responsibilities and company background']})).toEqual(['SQL']);
  });
});
