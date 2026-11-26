import {afterEach,expect,it,vi} from 'vitest';
afterEach(()=>vi.unstubAllGlobals());
it('refreshes company data on the next visit instead of keeping the old import indefinitely',async()=>{
 vi.resetModules();const fetch=vi.fn().mockResolvedValueOnce({ok:true,json:async()=>[{id:'old',name:'Old Company'}]}).mockResolvedValueOnce({ok:true,json:async()=>[{id:'old',name:'Old Company'},{id:'new',name:'New Company'}]});vi.stubGlobal('fetch',fetch);
 const {loadDiscoveryCompanies}=await import('../src/services/discoveryCompanies.js');
 expect(await loadDiscoveryCompanies()).toHaveLength(1);expect(await loadDiscoveryCompanies()).toHaveLength(2);expect(fetch).toHaveBeenLastCalledWith('/data/discovery-companies.json',{cache:'no-store'});
});
it('shares simultaneous reads and permits a retry after a failed request',async()=>{
 vi.resetModules();const fetch=vi.fn().mockResolvedValueOnce({ok:false}).mockResolvedValueOnce({ok:true,json:async()=>[{id:'new',name:'New Company'}]});vi.stubGlobal('fetch',fetch);
 const {loadDiscoveryCompanies}=await import('../src/services/discoveryCompanies.js');
 const results=await Promise.allSettled([loadDiscoveryCompanies(),loadDiscoveryCompanies()]);expect(results.every(r=>r.status==='rejected')).toBe(true);expect(fetch).toHaveBeenCalledTimes(1);expect(await loadDiscoveryCompanies()).toHaveLength(1);
});
