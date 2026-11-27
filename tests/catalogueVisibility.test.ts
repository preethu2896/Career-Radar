import{it,expect}from'vitest';import{publicCatalogueView}from'../supabase/functions/_shared/catalogueVisibility.js';
it('strips direct and nested careers/apply/contact URLs from public browse responses',()=>{const input={job:{application_url:'https://jobs.example.com/apply',source_url:'https://ats.example.com/job',description:'Apply https://example.com/apply or mail hr@example.com',contact_email:'hr@example.com'},company:{website:'https://example.com/careers',careerUrls:['https://ats.example.com/company'],sourceRows:[{sourceUrl:'https://ats.example.com/role',careerUrl:'https://example.com/careers'}],roles:[{url:'https://example.com/apply'}],profilePath:'/jobs/india/city/company',logoUrl:'/company-logos/imported/test.png'}};const output=publicCatalogueView(input);expect(output.job.application_url).toBeNull();expect(output.company.careerUrls).toEqual([]);expect(output.company.hasCareerPortal).toBe(true);expect(output.company.website).toBe('https://example.com');expect(output.company.profilePath).toBe(input.company.profilePath);expect(output.company.logoUrl).toBe(input.company.logoUrl);expect(JSON.stringify(output)).not.toContain('ats.example.com');expect(JSON.stringify(output)).not.toContain('hr@example.com');expect(input.company.careerUrls).toHaveLength(1);});
it('never presents ATS board origins as public company websites',()=>{expect(publicCatalogueView({website:'https://jobs.lever.co/company'}).website).toBeNull();});

it('preserves verified source evidence across trusted public proxy sanitization without accepting an unverified raw flag',()=>{
 const raw={job:{status:'OPEN',source_url:'https://ats.example/job'}};
 const sanitized=publicCatalogueView(raw);
 expect(publicCatalogueView(sanitized,{alreadyPublic:true}).job.has_verified_source).toBe(true);
 expect(publicCatalogueView({job:{status:'OPEN',source_url:null,has_verified_source:true}}).job.has_verified_source).toBe(false);
 expect(publicCatalogueView(sanitized,{alreadyPublic:true}).job.source_url).toBeNull();
});
