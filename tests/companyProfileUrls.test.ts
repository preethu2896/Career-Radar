import {expect,it} from 'vitest';
import {assignCompanyProfilePaths,companyProfilePath,companyPlace,parseCompanyProfilePath} from '../src/services/companyProfileUrls.js';
import {parseJobPath} from '../src/services/jobUrls.js';
it('uses country, city and company name without inventing an office address',()=>{
 const company={name:'Example Software Pvt. Ltd.',cityAssociations:[{city:null,datasetCity:'Bangalore'}]};
 expect(companyProfilePath(company)).toBe('/jobs/india/bengaluru/example-software-pvt-ltd');expect(companyPlace({name:'No location'})).toEqual({country:'Unknown',city:'Unspecified'});
});
it('keeps duplicate company identities separate and deterministic',()=>{
 const rows=[{id:'one',name:'Acme',location:'Pune'},{id:'two',name:'Acme',location:'Pune'}];
 const paths=assignCompanyProfilePaths(rows);expect(new Set(paths.map(r=>r.profilePath)).size).toBe(2);expect(assignCompanyProfilePaths([...rows].reverse()).find(r=>r.id==='one')?.profilePath).toBe(paths[0]?.profilePath);
});
it('distinguishes company pages from existing role pages and rejects malformed paths',()=>{
 expect(parseCompanyProfilePath('/jobs/india/bengaluru/acme')).toEqual({country:'india',city:'bengaluru',company:'acme'});
 expect(parseJobPath('/jobs/acme/data-analyst')).toEqual({company:'acme',role:'data-analyst'});
 expect(parseCompanyProfilePath('/jobs/acme/data-analyst')).toBeNull();expect(parseJobPath('/jobs/india/bengaluru/acme')).toBeNull();
 for(const path of ['/jobs/india/bengaluru/%2Fbad','/jobs/india/bengaluru/%ZZ','/jobs/india/bengaluru/../../evil'])expect(parseCompanyProfilePath(path)).toBeNull();
});
